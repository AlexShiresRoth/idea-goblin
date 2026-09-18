import { getIdeaBuckets } from "@/lib/api/";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import CreateIdeaModal from "../components/create-idea-modal";
import Bucket from "./bucket";
import "./page.css";
import Sidebar from "./sidebar";

export default async function Main() {
  const session = await getSession();

  if (!session || !session.id) {
    redirect("/");
  }

  const buckets = await getIdeaBuckets(session.id);

  return (
    <main className="flex md:flex-row flex-col gap-4 items-center w-full h-screen">
      <Sidebar />
      <div className="flex flex-col w-11/12 py-10 h-full overflow-auto">
        <div className="flex md:flex-row flex-col md:items-end gap-8 border-b border-white/20 pb-4">
          <h1 className="text-5xl font-bold">Idea Goblin</h1>
          <CreateIdeaModal type="inline" />
        </div>
        <div
          data-testid="buckets-container"
          className="buckets-container flex flex-col md:flex-row md:flex-wrap items-start justify-start md:gap-8 gap-2 mt-10 border border-white/20 rounded-lg p-8 overflow-y-scroll"
        >
          {buckets.map((bucket) => (
            <Bucket key={bucket.id} bucket={bucket} />
          ))}
        </div>
        <CreateIdeaModal type="floating" />
      </div>
    </main>
  );
}
