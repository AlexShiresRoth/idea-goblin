import { DeleteAnalysisButton } from "@/app/components/delete-analysis-button";
import { getAnalysisResults } from "@/lib/api/analysis";
import { PATHWAYSJSON } from "@/lib/constants";
import type { AnalysisResult as AnalysisRecord } from "@/lib/db/schema";
import type { ExecutionResult, PathwayId } from "@/lib/types";
import { isBucketRefinement, isIdeaRefinement } from "@/lib/types";
import { Ghost, Waypoints, Wrench } from "lucide-react";
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
};

function AnalysisItem({ analysis }: { analysis: AnalysisRecord }) {
  const pathway = PATHWAYS[analysis.analysisType];
  const updatedAt = formatDate(analysis.updatedAt);
  const icon = PathwayIcons[analysis.analysisType];
  const data = analysis.analysisData;
  const refinedFrom = isBucketRefinement(data)
    ? data.original_name
    : isIdeaRefinement(data)
      ? data.original_title
      : undefined;
  const isExecution = analysis.analysisType === "execution";

  return (
    <div className="flex w-full md:w-fit flex-col gap-2 rounded-lg p-4 border border-white/10 hover:bg-white/5 transition-colors hover:border-white/50">
      <Link
        href={`/main/analysis/${analysis.id}`}
        className="flex flex-col gap-2"
      >
        <div className="flex items-center gap-2">
          {icon}
          <p>{pathway.title}</p>
        </div>
        {refinedFrom && (
          <p className="text-sm text-white/80 truncate max-w-sm">
            {refinedFrom}
          </p>
        )}
        {isExecution && (
          <p className="text-sm text-white/80 truncate max-w-sm">
            {(analysis.analysisData as ExecutionResult).summary}
          </p>
        )}
        <p className="text-sm text-white/50">Updated {updatedAt}</p>
      </Link>
      <DeleteAnalysisButton analysisId={analysis.id} />
    </div>
  );
}

export default async function AnalysisPage() {
  const analysis = await getAnalysisResults();

  if (analysis.length === 0) {
    return (
      <div className="p-4 w-full h-full flex items-center justify-center">
        <p className="text-sm text-white/50">
          No saved analyses yet. Save one from Analyze Vault and the goblin
          keeps it here.
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 flex w-full">
      <div className="flex md:flex-row flex-col items-start content-start gap-4 w-full md:flex-wrap">
        {analysis.map((item) => {
          return <AnalysisItem key={item.id} analysis={item} />;
        })}
      </div>
    </div>
  );
}
