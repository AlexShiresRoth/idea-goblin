import { AuthGuard } from "@/lib/auth/auth-guard";
import { isBucketCategory, isDone } from "@/lib/constants";
import { db } from "@/lib/db";
import {
  bucketVersionsTable,
  ideaBucketLinksTable,
  ideaBucketsTable,
  ideasTable,
} from "@/lib/db/schema";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

const RefinementSchema = z
  .object({
    bucketId: z.number().int().positive(),
    name: z.string().trim().min(1).max(200),
    description: z.string().trim().min(1).max(4000),
    category: z.string().optional(),
    updateDetails: z.boolean(),
    ideasMode: z.enum(["none", "add", "replace"]),
    ideas: z
      .array(
        z.object({
          title: z.string().trim().min(1).max(200),
          description: z.string().trim().min(1).max(4000),
        }),
      )
      .max(30),
  })
  .refine(
    ({ updateDetails, ideasMode, ideas }) =>
      (updateDetails || ideas.length > 0) &&
      (ideasMode === "none" ? ideas.length === 0 : ideas.length > 0),
    { message: "Select bucket details or ideas to apply" },
  );

class BucketNotFoundError extends Error {}

export async function POST(request: Request) {
  try {
    const session = await AuthGuard();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const parsed = RefinementSchema.safeParse(
      await request.json().catch(() => null),
    );
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid refinement" },
        { status: 400 },
      );
    }
    const {
      bucketId,
      name,
      description,
      category,
      updateDetails,
      ideasMode,
      ideas,
    } = parsed.data;
    const profileId = session.user.id;

    await db.transaction(async (tx) => {
      const [bucket] = await tx
        .select()
        .from(ideaBucketsTable)
        .where(
          and(
            eq(ideaBucketsTable.id, bucketId),
            eq(ideaBucketsTable.profileId, profileId),
            isNull(ideaBucketsTable.deletedAt),
          ),
        )
        .for("update");
      if (!bucket) throw new BucketNotFoundError("Bucket not found");

      // Use the same snapshot shape as snapshotBucket, but keep every query
      // on this transaction so a failed apply cannot leave a version behind.
      const currentIdeas = await tx
        .select({
          id: ideasTable.id,
          title: ideasTable.title,
          description: ideasTable.description,
          category: ideasTable.category,
          status: ideasTable.status,
          type: ideasTable.type,
        })
        .from(ideaBucketLinksTable)
        .innerJoin(ideasTable, eq(ideasTable.id, ideaBucketLinksTable.ideaId))
        .where(eq(ideaBucketLinksTable.bucketId, bucketId))
        .orderBy(ideasTable.createdAt)
        // Lock linked ideas (including their statuses) and links until apply commits.
        .for("update");
      await tx.insert(bucketVersionsTable).values({
        bucketId,
        name: bucket.name,
        description: bucket.description,
        theme: bucket.theme,
        category: bucket.category,
        ideas: currentIdeas,
      });

      if (ideasMode === "replace") {
        const openIdeaIds = currentIdeas
          .filter((idea) => !isDone(idea))
          .map((idea) => idea.id);
        // Preserve completed links and idea rows shared by buckets or versions.
        if (openIdeaIds.length > 0) {
          await tx
            .delete(ideaBucketLinksTable)
            .where(
              and(
                eq(ideaBucketLinksTable.bucketId, bucketId),
                inArray(ideaBucketLinksTable.ideaId, openIdeaIds),
              ),
            );
        }
      }
      if (ideas.length > 0) {
        const inserted = await tx
          .insert(ideasTable)
          .values(
            ideas.map((idea) => ({
              ...idea,
              profileId,
              category: isBucketCategory(category)
                ? category
                : bucket.category || "general",
              type: "idea",
              status: "incubating",
              embedding: null,
            })),
          )
          .returning({ id: ideasTable.id });
        await tx
          .insert(ideaBucketLinksTable)
          .values(inserted.map((idea) => ({ ideaId: idea.id, bucketId })));
      }

      await tx
        .update(ideaBucketsTable)
        .set({
          ...(updateDetails && {
            name,
            description,
            ...(isBucketCategory(category) && { category }),
          }),
          updatedAt: new Date(),
        })
        .where(eq(ideaBucketsTable.id, bucketId));
    });

    return NextResponse.json({ bucketId, added: ideas.length });
  } catch (error) {
    if (error instanceof BucketNotFoundError) {
      return NextResponse.json({ error: "Bucket not found" }, { status: 404 });
    }
    console.error(error);
    return NextResponse.json(
      { error: "Failed to apply refinement" },
      { status: 500 },
    );
  }
}
