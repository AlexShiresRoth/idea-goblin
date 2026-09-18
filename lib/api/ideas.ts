import { eq, inArray } from "drizzle-orm";
import "server-only";
import { db } from "../db";
import { ideaBucketLinksTable, ideasTable } from "../db/schema";

export async function getIdeas(bucketId: number) {
  const bucketLinks = await db
    .select()
    .from(ideaBucketLinksTable)
    .where(eq(ideaBucketLinksTable.bucketId, bucketId));
  const ideas = await db
    .select()
    .from(ideasTable)
    .where(
      inArray(
        ideasTable.id,
        bucketLinks.map((link) => link.ideaId),
      ),
    );

  return ideas;
}
