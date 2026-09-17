import { db } from "@/lib/db";
import { IdeaBucket, ideaBucketLinksTable, ideasTable } from "@/lib/db/schema";
import { eq, inArray } from "drizzle-orm";
import Ideas from "./ideas";

async function getIdeas(bucketId: number) {
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

export default async function Bucket({ bucket }: { bucket: IdeaBucket }) {
  const ideas = await getIdeas(bucket.id);

  return <Ideas ideas={ideas} bucket={bucket} />;
}
