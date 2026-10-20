import { getBucketIdeas, snapshotBucket } from "@/lib/api/buckets";
import { AuthGuard } from "@/lib/auth/auth-guard";
import { db } from "@/lib/db";
import {
  bucketVersionsTable,
  ideaBucketLinksTable,
  ideaBucketsTable,
  ideasTable,
} from "@/lib/db/schema";
import { and, eq, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";
import OpenAI from "openai";

const client = new OpenAI();

async function embed(title: string, description: string) {
  try {
    const response = await client.embeddings.create({
      model: "text-embedding-3-small",
      input: `Title: ${title}\nDescription: ${description}`.trim(),
    });
    return response.data[0].embedding;
  } catch (error) {
    console.error(error);
    return null;
  }
}

// Puts the bucket back the way the version saw it: its name, description and
// theme and category, and exactly the ideas it held then, with their text at that time.
export async function POST(request: Request) {
  try {
    const session = await AuthGuard();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { versionId } = (await request.json()) as { versionId?: number };

    if (!versionId) {
      return NextResponse.json(
        { error: "Version ID is required" },
        { status: 400 },
      );
    }

    const [row] = await db
      .select({ version: bucketVersionsTable, bucket: ideaBucketsTable })
      .from(bucketVersionsTable)
      .innerJoin(
        ideaBucketsTable,
        eq(ideaBucketsTable.id, bucketVersionsTable.bucketId),
      )
      .where(
        and(
          eq(bucketVersionsTable.id, versionId),
          eq(ideaBucketsTable.profileId, session.user.id),
        ),
      )
      .limit(1);

    if (!row) {
      return NextResponse.json({ error: "Version not found" }, { status: 404 });
    }

    const { version, bucket } = row;

    // Keep the current state as a version too, so a restore can be undone.
    await snapshotBucket(bucket);

    const current = await getBucketIdeas(bucket.id);
    const currentById = new Map(current.map((idea) => [idea.id, idea]));
    const targetIds = new Set(version.ideas.map((idea) => idea.id));

    // Ideas live and die with their bucket, so ones added since are deleted.
    const toDelete = current.filter((idea) => !targetIds.has(idea.id));
    const toUpdate = version.ideas.filter((idea) => {
      const existing = currentById.get(idea.id);
      return (
        existing &&
        (existing.title !== idea.title ||
          existing.description !== idea.description ||
          existing.category !== idea.category ||
          existing.status !== idea.status)
      );
    });
    const toRecreate = version.ideas.filter(
      (idea) => !currentById.has(idea.id),
    );

    const embeddings = new Map(
      await Promise.all(
        [...toUpdate, ...toRecreate].map(
          async (idea) =>
            [idea.id, await embed(idea.title, idea.description)] as const,
        ),
      ),
    );

    await db.transaction(async (tx) => {
      await tx
        .update(ideaBucketsTable)
        .set({
          name: version.name,
          description: version.description,
          theme: version.theme,
          category: version.category,
          updatedAt: new Date(),
        })
        .where(eq(ideaBucketsTable.id, bucket.id));

      if (toDelete.length > 0) {
        await tx.delete(ideasTable).where(
          inArray(
            ideasTable.id,
            toDelete.map((idea) => idea.id),
          ),
        );
      }

      for (const idea of toUpdate) {
        await tx
          .update(ideasTable)
          .set({
            title: idea.title,
            description: idea.description,
            category: idea.category,
            status: idea.status,
            embedding: embeddings.get(idea.id) ?? undefined,
            updatedAt: new Date(),
          })
          .where(eq(ideasTable.id, idea.id));
      }

      for (const idea of toRecreate) {
        const [created] = await tx
          .insert(ideasTable)
          .values({
            title: idea.title,
            description: idea.description,
            category: idea.category,
            status: idea.status,
            type: idea.type,
            profileId: session.user.id,
            embedding: embeddings.get(idea.id) ?? null,
          })
          .returning({ id: ideasTable.id });

        await tx
          .insert(ideaBucketLinksTable)
          .values({ ideaId: created.id, bucketId: bucket.id });
      }
    });

    return NextResponse.json({ message: "Version restored" });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to restore version" },
      { status: 500 },
    );
  }
}
