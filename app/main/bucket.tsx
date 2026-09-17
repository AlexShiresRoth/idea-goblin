import { db } from "@/lib/db";
import { IdeaBucket, ideaBucketLinksTable, ideasTable } from "@/lib/db/schema";
import { eq, inArray } from "drizzle-orm";

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
  console.log("IDEAS", ideas);
  return (
    <div className="flex flex-col gap-4 p-4 border border-white/20 rounded-lg">
      <h2 className="text-2xl font-bold">{bucket.name}</h2>
      <p className="text-sm text-white/50">{bucket.description}</p>
      <div className="flex flex-col gap-2">
        {ideas.map((idea) => (
          <div key={idea.id}>{idea.title}</div>
        ))}
      </div>
    </div>
  );
}
