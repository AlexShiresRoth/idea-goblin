import {
  AI_MODELS,
  isRateLimited,
  RATE_LIMITS,
  recordRun,
  responseUsage,
} from "@/lib/ai";
import { touchBuckets } from "@/lib/api/buckets";
import { ensureProfile } from "@/lib/api/profiles";
import { AuthGuard } from "@/lib/auth/auth-guard";
import { isBucketCategory } from "@/lib/constants";
import { db } from "@/lib/db";
import {
  ideaBucketLinksTable,
  ideaBucketsTable,
  ideasTable,
  type IdeaBucket,
} from "@/lib/db/schema";
import {
  ImportRequestSchema,
  type ImportRow,
  type ImportSummary,
} from "@/lib/import/schema";
import { encodeEvent, NDJSON_HEADERS } from "@/lib/ndjson";
import {
  describeBuckets,
  describeIdeas,
  sortIdeasIntoBuckets,
  type DescribedIdea,
} from "@/lib/prompts/import";
import { and, cosineDistance, eq, isNotNull } from "drizzle-orm";
import OpenAI from "openai";

const client = new OpenAI();

const DESCRIBE_BATCH_SIZE = 25;
// Cosine distance under which an imported idea counts as one already in the
// vault (similarity of 0.92 or more).
const DUPLICATE_DISTANCE = 0.08;
// Where an auto-sorted idea goes if sorting leaves it without a bucket.
const FALLBACK_BUCKET_NAME = "Imported ideas";

type Usage = { input: number; output: number; reasoning: number };

type PreparedIdea = {
  row: ImportRow;
  title: string;
  category: string;
  type: string;
  bucketCategory?: string;
  embedding: number[];
};

type NewBucket = Pick<
  IdeaBucket,
  "name" | "description" | "theme" | "category"
>;

// An existing bucket, or a key into the buckets the import will create.
type Destination = { bucketId: number } | { key: string };

function plural(count: number, word: string) {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

function chunk<T>(items: T[], size: number) {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function normalizeName(name: string) {
  return name.trim().toLowerCase();
}

async function nearestIdea(profileId: string, embedding: number[]) {
  const distance = cosineDistance(ideasTable.embedding, embedding);
  const [match] = await db
    .select({ id: ideasTable.id, title: ideasTable.title, distance })
    .from(ideasTable)
    .where(
      and(eq(ideasTable.profileId, profileId), isNotNull(ideasTable.embedding)),
    )
    .orderBy(distance)
    .limit(1);
  return match ? { ...match, distance: Number(match.distance) } : null;
}

function streamImport({
  profileId,
  rows,
  buckets,
  allowDuplicates,
}: {
  profileId: string;
  rows: ImportRow[];
  buckets: IdeaBucket[];
  allowDuplicates: boolean;
}) {
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: object) => controller.enqueue(encodeEvent(event));
      const status = (step: string, message: string) =>
        send({ type: "status", step, message });
      const usage: Usage = { input: 0, output: 0, reasoning: 0 };
      let calledModel = false;
      const addUsage = (next: Usage) => {
        calledModel = true;
        usage.input += next.input;
        usage.output += next.output;
        usage.reasoning += next.reasoning;
      };

      try {
        status("context", `Read ${plural(rows.length, "idea")}`);

        // 1. Titles, categories and types, in parallel batches.
        status("naming", "Naming your ideas");
        const described = new Map<number, DescribedIdea>();
        let named = 0;
        await Promise.all(
          chunk(
            rows.map((row, index) => ({
              index,
              title: row.title || undefined,
              description: row.description,
            })),
            DESCRIBE_BATCH_SIZE,
          ).map(async (batch) => {
            const response = await describeIdeas(client, batch);
            addUsage(responseUsage(response.usage));
            for (const idea of response.output_parsed?.ideas ?? []) {
              described.set(idea.index, idea);
            }
            named += batch.length;
            status("naming", `Named ${named} of ${rows.length} ideas`);
          }),
        );

        // 2. Embeddings for every idea in one call.
        status("duplicates", "Sniffing for ideas you already have");
        const drafts = rows.map((row, index) => {
          const info = described.get(index);
          // A batch that skipped an idea still leaves it importable.
          return {
            row,
            title: row.title || info?.title || row.description.slice(0, 80),
            category: info?.category || "general",
            type: info?.type || "idea",
            bucketCategory: info?.bucketCategory,
          };
        });
        const embeddings = await client.embeddings.create({
          model: "text-embedding-3-small",
          input: drafts.map((idea) =>
            `
      Title: ${idea.title}
      Type: ${idea.type}
      Category: ${idea.category}
      Description: ${idea.row.description}
        `.trim(),
          ),
        });
        const ideas: PreparedIdea[] = drafts.map((idea, index) => ({
          ...idea,
          embedding:
            embeddings.data.find((item) => item.index === index)?.embedding ??
            embeddings.data[index].embedding,
        }));

        // 3. Leave out ideas that look like ones already in the vault.
        const skipped: ImportSummary["skipped"] = [];
        let kept = ideas;
        if (!allowDuplicates) {
          const matches = await Promise.all(
            ideas.map((idea) => nearestIdea(profileId, idea.embedding)),
          );
          kept = ideas.filter((idea, index) => {
            const match = matches[index];
            if (!match || !(match.distance <= DUPLICATE_DISTANCE)) return true;
            skipped.push({
              row: idea.row,
              duplicateOf: { id: match.id, title: match.title },
            });
            return false;
          });
          if (skipped.length > 0) {
            status(
              "duplicates",
              `${plural(skipped.length, "idea")} already in your hoard`,
            );
          }
        }

        // 4. Work out each idea's bucket.
        const bucketsById = new Map(
          buckets.map((bucket) => [bucket.id, bucket]),
        );
        const bucketsByName = new Map(
          buckets.map((bucket) => [normalizeName(bucket.name), bucket.id]),
        );
        const newBuckets = new Map<string, NewBucket>();
        // Buckets created by name without a description from the user.
        const undescribed = new Set<string>();

        const byName = (
          name: string,
          idea: PreparedIdea,
          description?: string,
        ): Destination => {
          const existing = bucketsByName.get(normalizeName(name));
          if (existing) return { bucketId: existing };
          const key = `named:${normalizeName(name)}`;
          if (!newBuckets.has(key)) {
            // Same defaults as adding a single idea to a new bucket, until
            // Goblin summarizes all of its ideas below.
            newBuckets.set(key, {
              name: name.trim(),
              description: description || idea.row.description,
              theme: idea.category,
              category: isBucketCategory(idea.bucketCategory)
                ? idea.bucketCategory
                : null,
            });
            if (!description) undescribed.add(key);
          }
          return { key };
        };

        const autoIdeas = kept.filter(
          (idea) => idea.row.target.type === "auto",
        );
        const autoDestinations = new Map<PreparedIdea, Destination>();
        if (autoIdeas.length > 0) {
          status(
            "sorting",
            `Sorting ${plural(autoIdeas.length, "idea")} into buckets`,
          );
          const response = await sortIdeasIntoBuckets(
            client,
            buckets,
            autoIdeas.map((idea, index) => ({
              index,
              title: idea.title,
              description: idea.row.description,
            })),
          );
          addUsage(responseUsage(response.usage));
          const sorted = response.output_parsed;
          const proposed = new Map(
            (sorted?.newBuckets ?? []).map((bucket) => [bucket.key, bucket]),
          );

          autoIdeas.forEach((idea, index) => {
            const assignment = sorted?.assignments.find(
              (item) => item.index === index,
            );
            if (assignment?.bucketId && bucketsById.has(assignment.bucketId)) {
              autoDestinations.set(idea, { bucketId: assignment.bucketId });
              return;
            }
            const bucket = assignment?.newBucketKey
              ? proposed.get(assignment.newBucketKey)
              : undefined;
            if (!bucket) {
              autoDestinations.set(idea, byName(FALLBACK_BUCKET_NAME, idea));
              return;
            }
            const key = `sorted:${bucket.key}`;
            if (!newBuckets.has(key)) {
              newBuckets.set(key, {
                name: bucket.name,
                description: bucket.description,
                theme: bucket.theme,
                category: isBucketCategory(bucket.category)
                  ? bucket.category
                  : null,
              });
            }
            autoDestinations.set(idea, { key });
          });
        }

        const destinations = kept.map((idea): Destination => {
          const { target } = idea.row;
          if (target.type === "existing") return { bucketId: target.bucketId };
          if (target.type === "named") {
            return byName(target.name, idea, target.description);
          }
          return autoDestinations.get(idea)!;
        });

        // A named bucket holding several ideas gets a description of all of
        // them, not just the first one's text.
        const toDescribe = [...undescribed].flatMap((key) => {
          const ideasInBucket = kept.filter((_, index) => {
            const destination = destinations[index];
            return "key" in destination && destination.key === key;
          });
          return ideasInBucket.length > 1
            ? [{ key, name: newBuckets.get(key)!.name, ideas: ideasInBucket }]
            : [];
        });
        if (toDescribe.length > 0) {
          status(
            "describing",
            `Describing ${plural(toDescribe.length, "new bucket")}`,
          );
          const response = await describeBuckets(
            client,
            toDescribe.map((bucket) => ({
              key: bucket.key,
              name: bucket.name,
              ideas: bucket.ideas.map((idea) => ({
                title: idea.title,
                description: idea.row.description,
              })),
            })),
          );
          addUsage(responseUsage(response.usage));
          for (const described of response.output_parsed?.buckets ?? []) {
            const bucket = newBuckets.get(described.key);
            if (!bucket || !undescribed.has(described.key)) continue;
            newBuckets.set(described.key, {
              ...bucket,
              description: described.description,
              theme: described.theme,
              category: isBucketCategory(described.category)
                ? described.category
                : bucket.category,
            });
          }
        }

        // 5. Save it all at once, so a failure leaves nothing half imported.
        status("saving", "Stashing them in the hoard");
        const counts = new Map<number, ImportSummary["buckets"][number]>();
        const now = new Date();

        if (kept.length > 0) {
          await db.transaction(async (tx) => {
            const createdIds = new Map<string, number>();
            for (const [key, bucket] of newBuckets) {
              const [created] = await tx
                .insert(ideaBucketsTable)
                .values({
                  ...bucket,
                  profileId,
                  createdAt: now,
                  updatedAt: now,
                })
                .returning();
              createdIds.set(key, created.id);
              counts.set(created.id, {
                id: created.id,
                name: created.name,
                created: true,
                count: 0,
              });
            }

            const links: { ideaId: number; bucketId: number }[] = [];
            for (const [index, idea] of kept.entries()) {
              const [created] = await tx
                .insert(ideasTable)
                .values({
                  title: idea.title,
                  category: idea.category,
                  type: idea.type,
                  description: idea.row.description,
                  profileId,
                  status: "incubating",
                  embedding: idea.embedding,
                  parentId: null,
                  createdAt: now,
                  updatedAt: now,
                })
                .returning({ id: ideasTable.id });
              const destination = destinations[index];
              const bucketId =
                "bucketId" in destination
                  ? destination.bucketId
                  : createdIds.get(destination.key)!;
              links.push({ ideaId: created.id, bucketId });

              const entry = counts.get(bucketId) ?? {
                id: bucketId,
                name: bucketsById.get(bucketId)?.name ?? "",
                created: false,
                count: 0,
              };
              entry.count += 1;
              counts.set(bucketId, entry);
            }
            await tx.insert(ideaBucketLinksTable).values(links);
          });

          await touchBuckets(
            [...counts.values()]
              .filter((bucket) => !bucket.created)
              .map((bucket) => bucket.id),
          );
        }

        const summary: ImportSummary = {
          created: kept.length,
          buckets: [...counts.values()],
          skipped,
        };
        send({ type: "done", data: summary });
      } catch (error) {
        console.error(error);
        send({
          type: "error",
          message: "The goblin dropped your import. Nothing was saved.",
        });
      } finally {
        // One run per import, so the rate limit counts imports.
        if (calledModel) {
          await recordRun({
            profileId,
            route: "idea-import",
            model: AI_MODELS.rank,
            usage,
          });
        }
        controller.close();
      }
    },
  });
}

export async function POST(request: Request) {
  try {
    const session = await AuthGuard();
    if (!session) {
      return new Response("Unauthorized", { status: 401 });
    }

    const parsed = ImportRequestSchema.safeParse(
      await request.json().catch(() => null),
    );
    if (!parsed.success) {
      return new Response("Invalid import", { status: 400 });
    }
    const { rows, allowDuplicates = false } = parsed.data;

    const profile = await ensureProfile(session);
    const buckets = await db
      .select()
      .from(ideaBucketsTable)
      .where(eq(ideaBucketsTable.profileId, profile.id));

    // Validate bucket choices before spending any tokens on them.
    const bucketIds = new Set(buckets.map((bucket) => bucket.id));
    if (
      rows.some(
        (row) =>
          row.target.type === "existing" && !bucketIds.has(row.target.bucketId),
      )
    ) {
      return new Response("Bucket not found", { status: 400 });
    }

    if (await isRateLimited(profile.id, "idea-import")) {
      const limit = RATE_LIMITS["idea-import"]!;
      return new Response(
        `The Goblin needs a break: ${limit.max} imports per ${limit.windowMinutes} minutes. Try again later.`,
        { status: 429 },
      );
    }

    return new Response(
      streamImport({ profileId: profile.id, rows, buckets, allowDuplicates }),
      { headers: NDJSON_HEADERS },
    );
  } catch (error) {
    console.error(error);
    return new Response("Internal Server Error", { status: 500 });
  }
}
