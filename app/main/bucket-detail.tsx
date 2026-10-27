"use client";
import { isDone } from "@/lib/constants";
import { IdeaBucket, type IdeaView } from "@/lib/db/schema";
import clsx from "clsx";
import {
  ChevronDownIcon,
  ChevronLeft,
  ChevronRight,
  ChevronUpIcon,
  CircleParkingIcon,
  CrosshairIcon,
  Loader2Icon,
  SparklesIcon,
  Trash2Icon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useContext, useState } from "react";
import { AnalyzeVaultModal } from "../components/analyze-vault";
import { bucketStyleVars } from "../components/bucket-icon";
import CreateIdeaModal from "../components/create-idea-modal";
import { useFocus } from "../components/focus-provider";
import ImportIdeasModal from "../components/import-ideas-modal";
import { ToastContext } from "../context/toast.provider";
import { doneCount, FocusBadge, ThemePill, timeAgo } from "./bucket-badges";
import BucketGameplan from "./bucket-gameplan";
import BucketShare from "./bucket-share";
import BucketVersions from "./bucket-versions";
import IdeaComponent from "./idea";

const IDEAS_PER_PAGE = 15;

// Starts or stops working on the bucket; hidden outside a FocusProvider.
function FocusToggle({ bucketId }: { bucketId: number }) {
  const focus = useFocus();
  if (!focus) return null;
  const active = focus.isActive(bucketId);
  return (
    <button
      type="button"
      data-testid="focus-toggle"
      disabled={focus.saving}
      onClick={() => (active ? focus.park(bucketId) : focus.workOn(bucketId))}
      className="flex items-center gap-1 p-2 text-white/50 rounded text-sm hover:cursor-pointer hover:text-green-400/80 transition-colors disabled:opacity-50"
    >
      {active ? (
        <>
          <CircleParkingIcon className="w-3 h-3" />
          Park
        </>
      ) : (
        <>
          <CrosshairIcon className="w-3 h-3" />
          Work on this
        </>
      )}
    </button>
  );
}

// A bucket's page: actions in the header, ideas on the left and the gameplan
// and versions on the right, stacked on small screens.
export default function BucketDetail({
  ideas,
  bucket,
}: {
  ideas: IdeaView[];
  bucket: IdeaBucket;
}) {
  const router = useRouter();
  const { setToasts } = useContext(ToastContext);
  const [isDeleting, setIsDeleting] = useState(false);
  const [refining, setRefining] = useState(false);
  // Collapses the header to one line, leaving more room for ideas.
  const [summaryOpen, setSummaryOpen] = useState(true);
  const summaryId = `bucket-summary-${bucket.id}`;
  const [rawStart, setStart] = useState(0);
  const [showDone, setShowDone] = useState(false);
  const [sideTab, setSideTab] = useState<"gameplan" | "versions">("gameplan");
  // Done ideas leave the paged list for their own section.
  const openIdeas = ideas.filter((idea) => !isDone(idea));
  const doneIdeas = ideas.filter(isDone);
  const take = IDEAS_PER_PAGE;
  const lastPageStart = Math.max(
    0,
    (Math.ceil(openIdeas.length / take) - 1) * take,
  );
  const start = Math.min(rawStart, lastPageStart);
  const pageIndex = Math.floor(start / take) + 1;
  const ideasPage = openIdeas.slice(start, start + take);
  const canGoLeft = start > 0;
  const canGoRight = start + take < openIdeas.length;

  async function deleteBucket() {
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/buckets/delete`, {
        method: "DELETE",
        body: JSON.stringify({ bucketId: bucket.id }),
      });
      if (!response.ok) throw new Error("Failed to delete bucket");
      setToasts([
        {
          id: bucket.id,
          message: `Deleted "${bucket.name}". Off to the rubbish heap.`,
          type: "success",
        },
      ]);
      router.replace("/main");
      router.refresh();
    } catch (error) {
      console.error(error);
      setToasts([
        { id: bucket.id, message: "Error deleting bucket", type: "error" },
      ]);
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <section
      aria-label={bucket.name}
      data-testid="bucket-detail"
      style={bucketStyleVars(bucket.category)}
      className="flex min-h-0 min-w-0 flex-1 flex-col bg-black"
    >
      <header
        className={clsx(
          "flex flex-col gap-4 border-b border-(--bucket-primary)/40 px-4 md:flex-row md:justify-between md:px-8",
          summaryOpen ? "py-4 md:items-start" : "py-2 md:items-center",
        )}
      >
        <div className="flex min-w-0 max-w-3xl flex-col gap-2">
          {summaryOpen && (
            <div className="flex items-center gap-3">
              <ThemePill bucket={bucket} />
              <FocusBadge active={bucket.activeSince != null} />
              <p className="text-xs text-white/50">
                Updated {timeAgo(bucket.updatedAt)} ago
              </p>
            </div>
          )}
          <div className="flex min-w-0 items-center gap-2">
            {!summaryOpen && <ThemePill bucket={bucket} />}
            <h1
              data-testid="bucket-name"
              className={clsx(
                "min-w-0",
                summaryOpen ? "text-2xl" : "truncate text-lg",
              )}
            >
              {bucket.name}
            </h1>
            <button
              type="button"
              aria-expanded={summaryOpen}
              aria-controls={summaryId}
              data-testid="toggle-bucket-summary"
              aria-label={summaryOpen ? "Hide summary" : "Show summary"}
              title={summaryOpen ? "Hide summary" : "Show summary"}
              onClick={() => setSummaryOpen(!summaryOpen)}
              className="shrink-0 rounded p-1 text-white/50 hover:cursor-pointer hover:bg-white/10 hover:text-white/80 transition-colors"
            >
              {summaryOpen ? (
                <ChevronUpIcon className="w-4 h-4" />
              ) : (
                <ChevronDownIcon className="w-4 h-4" />
              )}
            </button>
          </div>
          <p
            id={summaryId}
            hidden={!summaryOpen}
            data-testid="bucket-description"
            className="text-sm text-white/50"
          >
            {bucket.description}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <FocusToggle bucketId={bucket.id} />
          <CreateIdeaModal type="bucket" defaultBucket={bucket.id} />
          <ImportIdeasModal type="bucket" defaultBucket={bucket} />
          <BucketShare bucketId={bucket.id} shareToken={bucket.shareToken} />
          <button
            data-testid="refine-bucket"
            disabled={isDeleting || ideas.length === 0}
            onClick={() => setRefining(true)}
            className="flex items-center gap-1 p-2 text-white/50 rounded text-sm hover:cursor-pointer hover:text-orange-300/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <SparklesIcon className="w-3 h-3" />
            Refine
          </button>
          <button
            data-testid="delete-bucket"
            disabled={isDeleting}
            onClick={() => !isDeleting && deleteBucket()}
            className="flex items-center gap-1 p-2 text-white/50 rounded text-sm hover:cursor-pointer hover:text-red-500/80 transition-colors"
          >
            {isDeleting ? (
              <>
                <Loader2Icon className="w-3 h-3 animate-spin" />
                Deleting...
              </>
            ) : (
              <>
                <Trash2Icon className="w-3 h-3" />
                Delete
              </>
            )}
          </button>
        </div>
      </header>

      {/* Stacked and scrolled as one on small screens; side by side with
          independent scrolling from md up. */}
      <div className="min-h-0 flex-1 overflow-y-auto md:grid md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:overflow-hidden">
        <section
          className="flex flex-col md:min-h-0 md:overflow-y-auto"
          data-testid="idea-list"
        >
          <div
            data-testid="idea-header"
            className="sticky top-0 z-10 flex items-center justify-between border-b border-white/20 bg-black h-10 py-2 px-4 md:px-8"
          >
            <p className="text-white/60">
              Ideas {openIdeas.length}
              {doneIdeas.length > 0 && (
                <span className="ml-2 text-xs text-white/40">
                  {doneCount(ideas)}
                </span>
              )}
            </p>
            {openIdeas.length > take && (
              <div className="flex items-center gap-2">
                <button
                  aria-label="Previous ideas"
                  data-testid="ideas-prev-page"
                  disabled={!canGoLeft}
                  onClick={() => canGoLeft && setStart(start - take)}
                  className="hover:cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span data-testid="ideas-page-indicator">
                  {pageIndex} / {Math.ceil(openIdeas.length / take)}
                </span>
                <button
                  aria-label="Next ideas"
                  data-testid="ideas-next-page"
                  disabled={!canGoRight}
                  onClick={() => setStart(start + take)}
                  className="hover:cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
          {ideas.length === 0 ? (
            <p
              className="px-4 py-6 text-sm text-white/40 md:px-8"
              data-testid="ideas-empty"
            >
              No ideas in here yet. Add one to get the goblin chewing.
            </p>
          ) : openIdeas.length === 0 ? (
            <p
              className="px-4 py-6 text-sm text-white/40 md:px-8"
              data-testid="ideas-all-done"
            >
              Everything in here is done. Add another, or dig through the done
              pile below.
            </p>
          ) : (
            ideasPage.map((idea) => <IdeaComponent key={idea.id} idea={idea} />)
          )}
          {doneIdeas.length > 0 && (
            <div className="border-t border-white/10">
              <button
                type="button"
                aria-expanded={showDone}
                data-testid="toggle-done-ideas"
                onClick={() => setShowDone(!showDone)}
                className="flex w-full items-center gap-2 px-4 py-2 text-sm text-white/50 hover:cursor-pointer hover:text-white/80 transition-colors md:px-8"
              >
                <ChevronRight
                  className={clsx(
                    "w-3 h-3 transition-transform",
                    showDone && "rotate-90",
                  )}
                />
                Done {doneIdeas.length}
              </button>
              {showDone &&
                doneIdeas.map((idea) => (
                  <IdeaComponent key={idea.id} idea={idea} />
                ))}
            </div>
          )}
        </section>
        <aside className="border-t border-white/20 md:min-h-0 md:overflow-y-auto md:border-t-0 md:border-l">
          <div
            role="tablist"
            aria-label="Bucket side panel"
            data-testid="bucket-side-tabs"
            className="sticky top-0 z-10 flex h-10 gap-4 border-b border-white/20 bg-black px-4 md:px-8"
          >
            {(["gameplan", "versions"] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                role="tab"
                aria-selected={sideTab === tab}
                data-testid={`side-tab-${tab}`}
                onClick={() => setSideTab(tab)}
                className={clsx(
                  "-mb-px flex items-center border-b-2 text-sm transition-colors hover:cursor-pointer",
                  sideTab === tab
                    ? "border-(--bucket-primary) text-white"
                    : "border-transparent text-white/50 hover:text-white/80",
                )}
              >
                {tab === "gameplan" ? "Gameplan" : "Versions"}
              </button>
            ))}
          </div>
          {sideTab === "gameplan" ? (
            <BucketGameplan bucket={bucket} ideas={ideas} />
          ) : (
            <BucketVersions bucketId={bucket.id} />
          )}
        </aside>
      </div>

      {refining && (
        <AnalyzeVaultModal
          scopeBucket={bucket}
          onClose={() => setRefining(false)}
        />
      )}
    </section>
  );
}
