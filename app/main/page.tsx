import { getFocusLimit, getIdeaBuckets, getIdeasForBuckets } from "@/lib/api/";
import { getSession } from "@/lib/auth";
import Link from "next/link";
import CreateIdeaModal from "../components/create-idea-modal";
import { FocusBar, FocusProvider } from "../components/focus-provider";
import Bucket from "./bucket";
import "./page.css";
import { UpgradedToast } from "./upgraded-toast";

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
  const sort = params.sort === "active" ? "active" : "updated";
  const orderedBuckets = [...buckets].sort((a, b) => {
    if (sort === "active") {
      const activeOrder =
        Number(b.activeSince != null) - Number(a.activeSince != null);
      if (activeOrder !== 0) return activeOrder;
    }
    return (
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime() ||
      a.id - b.id
    );
  });

  return (
    <FocusProvider
      buckets={buckets.map((bucket) => ({
        id: bucket.id,
        name: bucket.name,
        active: bucket.activeSince != null,
      }))}
      limit={focusLimit}
    >
      <div className="flex flex-col h-full overflow-auto gap-4 flex-1">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <FocusBar />
          {buckets.length > 0 && (
            <nav
              aria-label="Sort buckets"
              className="flex flex-wrap items-center gap-1 px-4 py-2 text-sm"
            >
              <span className="mr-1 text-white/50">Sort by</span>
              {(
                [
                  ["active", "Actively working on"],
                  ["updated", "Recently updated"],
                ] as const
              ).map(([value, label]) => (
                <Link
                  key={value}
                  href={{
                    pathname: "/main",
                    query: { ...params, sort: value },
                  }}
                  aria-current={sort === value ? "true" : undefined}
                  className={`border px-3 py-1 transition-colors ${
                    sort === value
                      ? "border-accent/40 bg-accent/10 text-accent"
                      : "border-white/20 text-white/60 hover:border-accent/50 hover:text-accent"
                  }`}
                >
                  {label}
                </Link>
              ))}
            </nav>
          )}
        </div>
        <div
          data-testid="buckets-container"
          className="buckets-container colums-1 md:columns-xs content-start p-4 overflow-y-scroll"
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
