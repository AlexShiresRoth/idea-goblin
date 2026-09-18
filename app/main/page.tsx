import { getIdeaBuckets } from "@/lib/api/";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import CreateIdeaModal from "../components/create-idea-modal";
import Bucket from "./bucket";
import Container from "./container";
import Header from "./header";
import "./page.css";
import Sidebar from "./sidebar";
import SidebarContent from "./sidebar-content";

export default async function Main() {
  const session = await getSession();

  if (!session || !session.id) {
    redirect("/");
  }

  const buckets = await getIdeaBuckets(session.id);

  return (
    <main className="flex flex-col items-center h-screen">
      <Header name={session.user_metadata?.name} />
      <div className="flex w-full h-full">
        <Sidebar>
          <SidebarContent />
        </Sidebar>
        <Container>
          <div className="flex flex-col p-4 h-full overflow-auto gap-4 flex-1">
            <div
              data-testid="buckets-container"
              className="buckets-container flex flex-col md:flex-row md:flex-wrap items-start justify-start md:gap-8 gap-2 border border-white/20 rounded-lg p-8 overflow-y-scroll"
            >
              {buckets.map((bucket) => (
                <Bucket key={bucket.id} bucket={bucket} />
              ))}
            </div>
            <CreateIdeaModal type="floating" />
          </div>
        </Container>
      </div>
    </main>
  );
}
