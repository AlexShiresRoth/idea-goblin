import { getIdeaBuckets, getIdeasForBuckets } from "@/lib/api/";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import CreateIdeaModal from "../components/create-idea-modal";
import { ToastWrapper } from "../components/toast-wrapper";
import { ToastProvider } from "../context/toast.provider";
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
  const ideasByBucket = await getIdeasForBuckets(
    buckets.map((bucket) => bucket.id),
  );
  const orderedBuckets = [...buckets];

  return (
    <ToastProvider>
      <ToastWrapper>
        <main className="flex flex-col items-center h-screen">
          <Header />
          <div className="flex w-full h-full">
            <Sidebar>
              <SidebarContent name={session.user_metadata?.name} />
            </Sidebar>
            <Container>
              <div className="flex flex-col p-4 h-full overflow-auto gap-4 flex-1">
                <div
                  data-testid="buckets-container"
                  className="buckets-container colums-1 md:columns-xs content-start border border-white/20 rounded-lg p-4 overflow-y-scroll"
                >
                  {/* css columns goes from right to left */}
                  {orderedBuckets.map((bucket) => (
                    <Bucket
                      key={bucket.id}
                      bucket={bucket}
                      ideas={ideasByBucket.get(bucket.id) ?? []}
                    />
                  ))}
                </div>
                <CreateIdeaModal type="floating" />
              </div>
            </Container>
          </div>
        </main>
      </ToastWrapper>
    </ToastProvider>
  );
}
