import { and, desc, eq, inArray } from "drizzle-orm";
import "server-only";
import { db } from "../db";
import { isGameplan } from "../types";
import {
  analysisResultsTable,
  bucketVersionsTable,
  ideaBucketLinksTable,
  ideaBucketsTable,
  ideasTable,
  type BucketSnapshotIdea,
  type BucketVersion,
  type IdeaBucket,
} from "../db/schema";

export async function getIdeaBuckets(profileId: string) {
  const buckets = await db
    .select()
    .from(ideaBucketsTable)
    .where(eq(ideaBucketsTable.profileId, profileId))
    .orderBy(desc(ideaBucketsTable.updatedAt));
  return buckets;
}

// Buckets are ordered by updatedAt, so any idea added to one must touch it.
export async function touchBuckets(bucketIds: number[]) {
  if (bucketIds.length === 0) return;
  await db
    .update(ideaBucketsTable)
    .set({ updatedAt: new Date() })
    .where(inArray(ideaBucketsTable.id, bucketIds));
}

export async function getBucketIdeas(
  bucketId: number,
): Promise<BucketSnapshotIdea[]> {
  return db
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
    .orderBy(ideasTable.createdAt);
}

// Saves the bucket and every idea in it as one version, so the whole bucket
// can be restored later.
export async function snapshotBucket(
  bucket: Pick<IdeaBucket, "id" | "name" | "description" | "theme" | "category">,
) {
  const ideas = await getBucketIdeas(bucket.id);
  await db.insert(bucketVersionsTable).values({
    bucketId: bucket.id,
    name: bucket.name,
    description: bucket.description,
    theme: bucket.theme,
    category: bucket.category,
    ideas,
  });
}

export async function getBucketVersions(
  bucketId: number,
): Promise<BucketVersion[]> {
  return db
    .select()
    .from(bucketVersionsTable)
    .where(eq(bucketVersionsTable.bucketId, bucketId))
    .orderBy(desc(bucketVersionsTable.createdAt));
}

// A bucket shared by link: what a visitor sees, which leaves out the owner
// and the version history. Null when the token isn't a live share link.
export async function getSharedBucket(token: string) {
  const [bucket] = await db
    .select({
      id: ideaBucketsTable.id,
      name: ideaBucketsTable.name,
      description: ideaBucketsTable.description,
      theme: ideaBucketsTable.theme,
      category: ideaBucketsTable.category,
      profileId: ideaBucketsTable.profileId,
    })
    .from(ideaBucketsTable)
    .where(eq(ideaBucketsTable.shareToken, token))
    .limit(1);
  if (!bucket) return null;

  const [ideas, [gameplan]] = await Promise.all([
    getBucketIdeas(bucket.id),
    db
      .select({ data: analysisResultsTable.analysisData })
      .from(analysisResultsTable)
      .where(
        and(
          eq(analysisResultsTable.profileId, bucket.profileId),
          eq(analysisResultsTable.bucketId, bucket.id),
          eq(analysisResultsTable.analysisType, "gameplan"),
        ),
      )
      .orderBy(desc(analysisResultsTable.createdAt))
      .limit(1),
  ]);

  return {
    bucket: {
      name: bucket.name,
      description: bucket.description,
      theme: bucket.theme,
      category: bucket.category,
    },
    ideas,
    gameplan: gameplan && isGameplan(gameplan.data) ? gameplan.data : null,
  };
}
