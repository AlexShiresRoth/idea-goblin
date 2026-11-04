import { getFocusLimit, getIdeaBuckets, getIdeasForBuckets } from "@/lib/api/";
import { getSession } from "@/lib/auth";
import CreateIdeaModal from "../components/create-idea-modal";
import { FocusBar, FocusProvider } from "../components/focus-provider";
import Bucket from "./bucket";
import { UpgradedToast } from "./upgraded-toast";
import "./page.css";

export default async function Main({ searchParams }: PageProps<"/main">) {
  const session = await getSession();

  if (!session) {
    return null;
  }

  const [buckets, focusLimit, params] = await Promise.all([
    getIdeaBuckets(session.id),
    getFocusLimit(session.id),
    searchParams,
  ]);
  const ideasByBucket = await getIdeasForBuckets(
    buckets.map((bucket) => bucket.id),
  );
  const orderedBuckets = [...buckets];

  return (
    <FocusProvider
      buckets={buckets.map((bucket) => ({
        id: bucket.id,
        name: bucket.name,
        active: bucket.activeSince != null,
      }))}
      limit={focusLimit}
    >
      <div className="flex flex-col p-4 h-full overflow-auto gap-4 flex-1">
        <FocusBar />
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
        {params.upgraded && <UpgradedToast />}
      </div>
    </FocusProvider>
  );
}
