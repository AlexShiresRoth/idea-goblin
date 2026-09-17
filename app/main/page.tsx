import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { ideaBucketsTable } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import CreateIdeaModal from "../components/create-idea-modal";
import Bucket from "./bucket";

async function getIdeaBuckets(profileId: string) {
  const buckets = await db
    .select()
    .from(ideaBucketsTable)
    .where(eq(ideaBucketsTable.profileId, profileId));
  return buckets;
}

export default async function Main() {
  const session = await getSession();

  if (!session || !session.id) {
    redirect("/");
  }

  const buckets = await getIdeaBuckets(session.id);

  return (
    <main className="flex flex-col gap-4 items-center w-full h-screen">
      <div className="flex flex-col w-11/12 py-10 h-full">
        <h1 className="text-5xl font-bold">Idea Goblin</h1>
        <div className="flex gap-8 mt-10 border border-white/20 rounded-lg p-8 flex-wrap h-full">
          {buckets.map((bucket) => (
            <Bucket key={bucket.id} bucket={bucket} />
          ))}
        </div>
        <CreateIdeaModal />
      </div>
    </main>
  );
}
