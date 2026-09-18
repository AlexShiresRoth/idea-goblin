import { eq } from "drizzle-orm";
import "server-only";
import { db } from "../db";
import { ideaBucketsTable } from "../db/schema";

export async function getIdeaBuckets(profileId: string) {
  const buckets = await db
    .select()
    .from(ideaBucketsTable)
    .where(eq(ideaBucketsTable.profileId, profileId));
  return buckets;
}
