"use client";
import { isDone } from "@/lib/constants";
import { IdeaBucket, type IdeaView } from "@/lib/db/schema";
import clsx from "clsx";
import {
  ChevronDownIcon,
  ChevronLeft,
  ChevronRight,
  ChevronUpIcon,
  Loader2Icon,
  SparklesIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useContext, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AnalyzeVaultModal } from "../components/analyze-vault";
import { BucketIcon, bucketStyleVars } from "../components/bucket-icon";
import CreateIdeaModal from "../components/create-idea-modal";
import ImportIdeasModal from "../components/import-ideas-modal";
import { ToastContext } from "../context/toast.provider";
import BucketGameplan from "./bucket-gameplan";
import BucketVersions from "./bucket-versions";
import IdeaComponent from "./idea";

const IDEAS_PER_PAGE = 10;

function timeAgo(date: Date) {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const diffInMinutes = Math.floor(diff / (1000 * 60));
  const diffInHours = Math.floor(diff / (1000 * 60 * 60));
  const diffInDays = Math.floor(diff / (1000 * 60 * 60 * 24));
  const diffInSeconds = Math.floor(diff / 1000);
  return diffInDays > 0
    ? `${diffInDays}d`
    : diffInHours > 0
      ? `${diffInHours}h`
      : diffInMinutes > 0
        ? `${diffInMinutes}m`
        : `${diffInSeconds}s`;
}

function doneCount(ideas: IdeaView[]) {
  return `${ideas.filter(isDone).length} of ${ideas.length} done`;
}

function ThemePill({ bucket }: { bucket: IdeaBucket }) {
  return (
    <div className="flex w-fit items-center gap-1 rounded-full border border-(--bucket-primary)/50 bg-(--bucket-accent)/10 px-2 py-1">
      <BucketIcon category={bucket.category} className="w-3 h-3" />
      <p className="text-xs text-(--bucket-tertiary)">{bucket.theme}</p>
    </div>
  );
}

// The open bucket: actions in the header, ideas on the left and versions on
// the right, stacked on small screens.
function BucketDetail({
  ideas,
  bucket,
  onClose,
}: {
  ideas: IdeaView[];
  bucket: IdeaBucket;
  onClose: () => void;
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

  // The page behind shouldn't scroll while the bucket fills the screen.
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

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
      onClose();
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

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={bucket.name}
      style={bucketStyleVars(bucket.category)}
      className="fixed inset-0 z-50 flex flex-col bg-black"
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
              <p className="text-xs text-white/50">
                Updated {timeAgo(bucket.updatedAt)} ago
              </p>
            </div>
          )}
          <div className="flex min-w-0 items-center gap-2">
            {!summaryOpen && <ThemePill bucket={bucket} />}
            <h2
              className={clsx(
                "min-w-0",
                summaryOpen ? "text-2xl" : "truncate text-lg",
              )}
            >
              {bucket.name}
            </h2>
            <button
              type="button"
              aria-expanded={summaryOpen}
              aria-controls={summaryId}
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
            className="text-sm text-white/50"
          >
            {bucket.description}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <CreateIdeaModal type="bucket" defaultBucket={bucket.id} />
          <ImportIdeasModal type="bucket" defaultBucket={bucket} />
          <button
            disabled={isDeleting || ideas.length === 0}
            onClick={() => setRefining(true)}
            className="flex items-center gap-1 p-2 text-white/50 rounded text-sm hover:cursor-pointer hover:text-orange-300/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <SparklesIcon className="w-3 h-3" />
            Refine
          </button>
          <button
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
          <button
            aria-label="Close bucket"
            onClick={onClose}
            className="ml-auto flex items-center p-2 rounded bg-white/10 text-sm hover:cursor-pointer hover:text-white/80 transition-colors md:ml-2"
          >
            <XIcon className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Stacked and scrolled as one on small screens; side by side with
          independent scrolling from md up. */}
      <div className="min-h-0 flex-1 overflow-y-auto md:grid md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] md:overflow-hidden">
        <section className="flex flex-col md:min-h-0 md:overflow-y-auto">
          <div
            data-testid="idea-header"
            className="sticky top-0 z-10 flex items-center justify-between border-b border-white/20 bg-black px-4 py-2 md:px-8"
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
                  disabled={!canGoLeft}
                  onClick={() => canGoLeft && setStart(start - take)}
                  className="hover:cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span>
                  {pageIndex} / {Math.ceil(openIdeas.length / take)}
                </span>
                <button
                  aria-label="Next ideas"
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
            <p className="px-4 py-6 text-sm text-white/40 md:px-8">
              No ideas in here yet. Add one to get the goblin chewing.
            </p>
          ) : openIdeas.length === 0 ? (
            <p className="px-4 py-6 text-sm text-white/40 md:px-8">
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
            className="sticky top-0 z-10 flex gap-4 border-b border-white/20 bg-black px-4"
          >
            {(["gameplan", "versions"] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                role="tab"
                aria-selected={sideTab === tab}
                onClick={() => setSideTab(tab)}
                className={clsx(
                  "-mb-px border-b-2 py-2 text-sm transition-colors hover:cursor-pointer",
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
    </div>,
    document.body,
  );
}

export default function IdeasBucket({
  ideas,
  bucket,
}: {
  ideas: IdeaView[];
  bucket: IdeaBucket;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <>
      <div
        data-idea-bucket-id={bucket.id}
        aria-label="button"
        onClick={() => setExpanded(true)}
        data-bucket-id={bucket.id}
        // Category colors as CSS variables; everything inside inherits them.
        style={bucketStyleVars(bucket.category)}
        className="flex bg-black flex-col gap-2 p-4 border border-white/20 rounded-lg items-start break-inside-avoid mb-2 hover:bg-black/60 hover:border-(--bucket-primary)/50 transition-colors cursor-pointer"
      >
        <div className="flex w-full items-center justify-between">
          <ThemePill bucket={bucket} />
          <p className="text-xs text-white/50">{timeAgo(bucket.updatedAt)}</p>
        </div>
        <h2 className="flex items-center gap-2 text-xl">{bucket.name}</h2>
        <p className="text-sm text-white/50">
          {bucket.description.slice(0, 200)}
          {bucket.description.length > 200 && "..."}
        </p>
        {ideas.some(isDone) && (
          <p className="text-xs text-white/40">{doneCount(ideas)}</p>
        )}
      </div>
      {expanded && (
        <BucketDetail
          ideas={ideas}
          bucket={bucket}
          onClose={() => setExpanded(false)}
        />
      )}
    </>
  );
}
