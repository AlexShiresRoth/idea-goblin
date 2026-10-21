import { DeleteAnalysisButton } from "@/app/components/delete-analysis-button";
import { getAnalysisResults } from "@/lib/api/analysis";
import { PATHWAYSJSON } from "@/lib/constants";
import type { AnalysisResult as AnalysisRecord } from "@/lib/db/schema";
import type { ExecutionResult, PathwayId } from "@/lib/types";
import { isBucketRefinement, isGameplan, isIdeaRefinement } from "@/lib/types";
import {
  ChevronLeft,
  ChevronRight,
  Flag,
  Ghost,
  Waypoints,
  Wrench,
} from "lucide-react";
import Link from "next/link";

const PATHWAYS = PATHWAYSJSON;
function formatDate(date: Date) {
  return new Date(date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

const PathwayIcons: Record<PathwayId, React.ReactNode> = {
  analysis: <Waypoints className="w-3 h-3" />,
  execution: <Ghost className="w-3 h-3" />,
  refinement: <Wrench className="w-3 h-3" />,
  gameplan: <Flag className="w-3 h-3" />,
};

function AnalysisItem({ analysis }: { analysis: AnalysisRecord }) {
  const pathway = PATHWAYS[analysis.analysisType];
  const updatedAt = formatDate(analysis.updatedAt);
  const icon = PathwayIcons[analysis.analysisType];
  const data = analysis.analysisData;
  const subject = isBucketRefinement(data)
    ? data.original_name
    : isIdeaRefinement(data)
      ? data.original_title
      : isGameplan(data)
        ? data.bucket_name
        : undefined;
  const isExecution = analysis.analysisType === "execution";

  return (
    <div className="flex w-full flex-col gap-2  p-4 border-b border-white/10 hover:bg-white/5 transition-colors hover:border-white/50">
      <Link
        href={`/main/analysis/${analysis.id}`}
        className="flex flex-col gap-2"
      >
        <div className="flex items-center gap-2">
          {icon}
          <p>{pathway.title}</p>
        </div>
        {subject && (
          <p className="text-sm text-white/80 truncate max-w-sm">{subject}</p>
        )}
        {isExecution && (
          <p className="text-sm text-white/80 truncate">
            {(analysis.analysisData as ExecutionResult).summary}
          </p>
        )}
        <p className="text-sm text-white/50">Updated {updatedAt}</p>
      </Link>
      <DeleteAnalysisButton analysisId={analysis.id} />
    </div>
  );
}

const PAGE_SIZE = 10;

const FILTERS: { label: string; type?: PathwayId }[] = [
  { label: "All" },
  { label: PATHWAYS.execution.title, type: "execution" },
  { label: PATHWAYS.refinement.title, type: "refinement" },
  { label: PATHWAYS.gameplan.title, type: "gameplan" },
];

function analysisHref(type?: PathwayId, page = 1) {
  const params = new URLSearchParams();
  if (type) params.set("type", type);
  if (page > 1) params.set("page", String(page));
  const query = params.toString();
  return query ? `/main/analysis?${query}` : "/main/analysis";
}

function parseType(value: string | string[] | undefined) {
  return value === "execution" || value === "refinement" ? value : undefined;
}

function parsePage(value: string | string[] | undefined) {
  const page = Number(value);
  return Number.isInteger(page) && page > 0 ? page : 1;
}

function FilterTabs({ activeType }: { activeType?: PathwayId }) {
  return (
    <nav className="flex flex-wrap items-center gap-1">
      {FILTERS.map(({ label, type }) => {
        const active = type === activeType;
        return (
          <Link
            key={label}
            href={analysisHref(type)}
            aria-current={active ? "page" : undefined}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1 text-sm transition-colors ${
              active
                ? "bg-white/15 text-white"
                : "text-white/50 hover:text-white/80 hover:bg-white/5"
            }`}
          >
            {type && PathwayIcons[type]}
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

function PageLink({
  href,
  label,
  children,
}: {
  href?: string;
  label: string;
  children: React.ReactNode;
}) {
  const className = "flex items-center justify-center rounded-md p-1";
  if (!href) {
    return (
      <span
        aria-label={label}
        aria-disabled
        className={`${className} text-white/20`}
      >
        {children}
      </span>
    );
  }
  return (
    <Link
      href={href}
      aria-label={label}
      className={`${className} text-white/50 hover:text-white/80 hover:bg-white/5 transition-colors`}
    >
      {children}
    </Link>
  );
}

function Pagination({
  type,
  page,
  totalPages,
}: {
  type?: PathwayId;
  page: number;
  totalPages: number;
}) {
  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center gap-2">
      <PageLink
        label="Previous page"
        href={page > 1 ? analysisHref(type, page - 1) : undefined}
      >
        <ChevronLeft className="w-4 h-4" />
      </PageLink>
      <p className="text-sm text-white/50 tabular-nums">
        {page} / {totalPages}
      </p>
      <PageLink
        label="Next page"
        href={page < totalPages ? analysisHref(type, page + 1) : undefined}
      >
        <ChevronRight className="w-4 h-4" />
      </PageLink>
    </div>
  );
}

export default async function AnalysisPage({
  searchParams,
}: PageProps<"/main/analysis">) {
  const params = await searchParams;
  const type = parseType(params.type);
  const requestedPage = parsePage(params.page);
  let { items, total } = await getAnalysisResults({
    type,
    page: requestedPage,
    pageSize: PAGE_SIZE,
  });
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(requestedPage, totalPages);
  // A stale page number (e.g. after deleting the last item on a page) falls
  // back to the last page that still has results.
  if (page !== requestedPage) {
    ({ items, total } = await getAnalysisResults({
      type,
      page,
      pageSize: PAGE_SIZE,
    }));
  }

  return (
    <div className="flex flex-col w-full h-full min-h-0">
      <div className="flex flex-wrap items-center justify-between gap-2 p-4 border-b border-white/20 shrink-0">
        <FilterTabs activeType={type} />
        <Pagination type={type} page={page} totalPages={totalPages} />
      </div>
      <div className="flex flex-col flex-1 min-h-0 overflow-y-auto">
        {items.length === 0 ? (
          <div className="p-4 w-full flex-1 flex items-center justify-center">
            <p className="text-sm text-white/50">
              {type
                ? `No saved ${PATHWAYS[type].title.toLowerCase()} results yet.`
                : "No saved analyses yet. Save one from Analyze Vault and the goblin keeps it here."}
            </p>
          </div>
        ) : (
          items.map((item) => <AnalysisItem key={item.id} analysis={item} />)
        )}
      </div>
    </div>
  );
}
