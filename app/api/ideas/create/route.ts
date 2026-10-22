import { AI_MODELS, chatUsage, recordRun } from "@/lib/ai";
import { touchBuckets } from "@/lib/api/buckets";
import { ensureProfile } from "@/lib/api/profiles";
import { activeSlotsForNewBuckets } from "@/lib/focus";
import { AuthGuard } from "@/lib/auth/auth-guard";
import { isBucketCategory } from "@/lib/constants";
import { db } from "@/lib/db";
import {
  Idea,
  IdeaBucket,
  ideaBucketLinksTable,
  ideaBucketsTable,
  ideasTable,
} from "@/lib/db/schema";
import { findRelevantBucket, generateIdeaResponse } from "@/lib/prompts";
import type { BucketChoice } from "@/lib/types";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const MAX_BUCKET_NAME_LENGTH = 100;
// Same limit as editing an idea's title.
const MAX_TITLE_LENGTH = 200;

type CreateIdeaPayload = {
  description?: string;
  // The user's own title; without one, the Goblin names the idea.
  title?: string;
  bucket?: BucketChoice;
  bucketName?: string;
};

type BucketResponse = {
  action: "use_existing" | "create_new";
  bucketId: number | null;
  relevanceScore: number;
  newBucketName: string | null;
  newBucketDescription: string | null;
  newBucketTheme: string | null;
  newBucketCategory: string | null;
  reasoning: string;
};

async function createIdea(idea: Omit<Idea, "id">) {
  const newIdea = await db.insert(ideasTable).values(idea).returning();

  return newIdea;
}

async function createIdeaBucket(bucket: Omit<IdeaBucket, "id">) {
  const newBucket = await db
    .insert(ideaBucketsTable)
    .values(bucket)
    .returning();
  return newBucket;
}

async function createIdeaBucketLink(ideaId: number, bucketId: number) {
  const newLink = await db
    .insert(ideaBucketLinksTable)
    .values({ ideaId, bucketId })
    .returning();
  return newLink;
}

export async function POST(request: Request) {
  try {
    const session = await AuthGuard();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const profile = await ensureProfile(session);

    const {
      description,
      bucket: bucketChoice = "auto",
      bucketName,
      title,
    } = (await request.json()) as CreateIdeaPayload;
    const userTitle = title?.trim() || undefined;

    if (!description || description.length < 3) {
      return NextResponse.json(
        { error: "Description is required" },
        { status: 400 },
      );
    }

    const buckets = await db
      .select()
      .from(ideaBucketsTable)
      .where(eq(ideaBucketsTable.profileId, profile.id));

    // A new bucket starts as worked on while the user's focus has room.
    const startsActive =
      activeSlotsForNewBuckets(buckets, profile.activeIdeasAmt) > 0;

    // Validate the user's choice before spending any tokens on it.
    if (
      bucketChoice !== "auto" &&
      bucketChoice !== "new" &&
      !buckets.some((existing) => existing.id === bucketChoice)
    ) {
      return NextResponse.json({ error: "Bucket not found" }, { status: 400 });
    }

    if (userTitle && userTitle.length > MAX_TITLE_LENGTH) {
      return NextResponse.json({ error: "Title is too long" }, { status: 400 });
    }

    if (bucketName && bucketName.trim().length > MAX_BUCKET_NAME_LENGTH) {
      return NextResponse.json(
        { error: "Bucket name is too long" },
        { status: 400 },
      );
    }

    const response = await generateIdeaResponse(client, description);
    await recordRun({
      profileId: profile.id,
      route: "idea-create",
      model: AI_MODELS.rank,
      usage: chatUsage(response.usage),
    });

    // The idea call also suggests a bucket category, used if it starts one.
    let idea: Idea & { bucketCategory?: string };

    try {
      idea = JSON.parse(response?.choices[0]?.message.content as string);
    } catch {
      return NextResponse.json(
        { error: "Invalid idea response" },
        { status: 400 },
      );
    }
    // The Goblin still picks the category and type; the user's title wins.
    if (userTitle) idea.title = userTitle;

    const embedding = await client.embeddings.create({
      model: "text-embedding-3-small",
      input: `
      Title: ${idea.title}
      Type: ${idea.type}
      Category: ${idea.category}
      Description: ${description}
        `.trim(),
    });

    idea.embedding = embedding.data[0].embedding;

    const newIdea = await createIdea({
      title: idea.title,
      category: idea.category,
      type: idea.type,
      description,
      profileId: profile.id,
      status: "incubating",
      createdAt: new Date(),
      updatedAt: new Date(),
      embedding: idea.embedding,
      parentId: null,
    });

    if (typeof bucketChoice === "number") {
      await createIdeaBucketLink(newIdea[0].id, bucketChoice);
      await touchBuckets([bucketChoice]);
      return NextResponse.json(newIdea);
    }

    if (bucketChoice === "new") {
      const newBucket = await createIdeaBucket({
        name: bucketName?.trim() || idea.title,
        description,
        theme: idea.category,
        category: isBucketCategory(idea.bucketCategory)
          ? idea.bucketCategory
          : null,
        profileId: profile.id,
        createdAt: new Date(),
        updatedAt: new Date(),
        activeSince: startsActive ? new Date() : null,
      });
      await createIdeaBucketLink(newIdea[0].id, newBucket[0].id);
      return NextResponse.json(newIdea);
    }

    const bucketResponse = await findRelevantBucket(
      client,
      buckets,
      newIdea[0],
    );
    await recordRun({
      profileId: profile.id,
      route: "bucket-classify",
      model: AI_MODELS.rank,
      usage: chatUsage(bucketResponse.usage),
    });

    let bucket: BucketResponse;

    try {
      bucket = JSON.parse(
        bucketResponse?.choices[0]?.message.content as string,
      );
    } catch {
      return NextResponse.json(
        { error: "Invalid bucket response" },
        { status: 400 },
      );
    }

    switch (bucket.action) {
      case "create_new":
        const newBucket = await createIdeaBucket({
          name: bucket.newBucketName as string,
          description: bucket.newBucketDescription as string,
          theme: bucket.newBucketTheme as string,
          category: isBucketCategory(bucket.newBucketCategory)
            ? bucket.newBucketCategory
            : null,
          profileId: profile.id,
          createdAt: new Date(),
          updatedAt: new Date(),
          activeSince: startsActive ? new Date() : null,
        });
        await createIdeaBucketLink(newIdea[0].id, newBucket[0].id);
        break;
      case "use_existing": {
        const bucketId = bucket.bucketId;
        if (!buckets.some((existing) => existing.id === bucketId)) {
          // Don't leave an unlinked idea behind for a bad classification.
          await db.delete(ideasTable).where(eq(ideasTable.id, newIdea[0].id));
          return NextResponse.json(
            { error: "Invalid bucket response" },
            { status: 400 },
          );
        }
        await createIdeaBucketLink(newIdea[0].id, bucketId as number);
        await touchBuckets([bucketId as number]);
        break;
      }
    }

    return NextResponse.json(newIdea);
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
