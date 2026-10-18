import {
  AnalysisResultConditional,
  ExecutionChoiceCard,
} from "@/app/components/analysis-result-condition";
import { DeleteAnalysisButton } from "@/app/components/delete-analysis-button";
import { ExpandableSection } from "@/app/components/expandable-section";
import { getAnalysisResult } from "@/lib/api/analysis";
import { PATHWAYSJSON } from "@/lib/constants";
import type { ExecutionResult, PathwayId, Reasoning } from "@/lib/types";
import { Ghost, Waypoints, Wrench } from "lucide-react";

const PathwayIcons: Record<PathwayId, React.ReactNode> = {
  analysis: <Waypoints className="w-3 h-3" />,
  execution: <Ghost className="w-3 h-3" />,
  refinement: <Wrench className="w-3 h-3" />,
};

function AnalysisReasoning({
  reasoning,
  showMainIdea = true,
}: {
  reasoning: Reasoning;
  showMainIdea?: boolean;
}) {
  return (
    <section className="flex flex-col gap-4">
      {showMainIdea && (
        <p className="text-white/70 max-w-2xl">{reasoning.main_idea}</p>
      )}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {reasoning.reasons.map((reason, index) => (
          <div
            key={`${reason.title}-${index}`}
            className="flex flex-col gap-2 rounded-lg bg-white/5 px-4 py-3 border-l-2 border-white/30"
          >
            <div className="flex items-center gap-2">
              <span className="text-xs text-white/40">{index + 1}</span>
              <h3 className="text-sm">{reason.title}</h3>
            </div>
            <p className="text-sm text-white/60">{reason.reasoning}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function ExecutionChoiceReasoning({
  choice,
}: {
  choice: ExecutionResult["choices"][number];
}) {
  return (
    <div className="flex flex-col gap-4">
      <ExecutionChoiceCard choice={choice} />
      {choice.reasoning.reasons.length > 0 && (
        <AnalysisReasoning reasoning={choice.reasoning} showMainIdea={false} />
      )}
    </div>
  );
}

export default async function AnalysisPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const analysis = await getAnalysisResult(id);

  if (!analysis) {
    return <div>Analysis not found</div>;
  }

  const { analysisData, analysisType } = analysis;

  return (
    <div className="p-4 flex flex-col gap-4 flex-1 w-full min-w-0">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          {PathwayIcons[analysisType]}
          <h1 className="text-2xl font-bold">
            {PATHWAYSJSON[analysisType].title}
          </h1>
        </div>
        <DeleteAnalysisButton
          analysisId={analysis.id}
          redirectTo="/main/analysis"
        />
      </div>
      {analysisType === "execution" && "summary" in analysisData && (
        <>
          {analysisData.summary && (
            <aside className="rounded-lg border border-white/15 bg-white/5 border-l-2 border-l-white/40 px-4 py-3 flex flex-col gap-2">
              <span className="text-xs uppercase tracking-wide text-white/40">
                Summary
              </span>
              <p className="text-sm text-white/80">{analysisData.summary}</p>
            </aside>
          )}
          {analysisData.choices.map((choice, index) => {
            const title =
              choice.title ??
              choice.main_idea ??
              choice.reasoning.main_idea ??
              `Idea ${index + 1}`;
            const preview = choice.main_idea ?? choice.reasoning.main_idea;

            return (
              <ExpandableSection
                key={choice.bucket_id}
                title={title}
                preview={preview !== title ? preview : choice.recommendation}
              >
                <ExecutionChoiceReasoning choice={choice} />
              </ExpandableSection>
            );
          })}
        </>
      )}
      {analysisType !== "execution" && "reasoning" in analysisData && (
        <ExpandableSection
          title={`Reasoning · ${analysisData.reasoning.reasons.length}`}
          preview={analysisData.reasoning.main_idea}
        >
          <AnalysisReasoning reasoning={analysisData.reasoning} />
        </ExpandableSection>
      )}
      {analysisType !== "execution" && (
        <ExpandableSection
          title={`Results · ${
            "suggestions" in analysisData
              ? analysisData.suggestions.length
              : "choices" in analysisData
                ? analysisData.choices.length
                : 1
          }`}
          defaultOpen
        >
          <AnalysisResultConditional result={analysisData} type={analysisType} />
        </ExpandableSection>
      )}
    </div>
  );
}
