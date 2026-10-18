import { desc, eq, inArray } from "drizzle-orm";
import "server-only";
import { db } from "../db";
import { ideaBucketsTable } from "../db/schema";

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
