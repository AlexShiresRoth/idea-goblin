import { AnalysisResultConditional } from "@/app/components/analysis-result-condition";
import { ExpandableSection } from "@/app/components/expandable-section";
import { getAnalysisResult } from "@/lib/api/analysis";
import { PATHWAYSJSON } from "@/lib/constants";
import type { PathwayId, Reasoning } from "@/lib/types";
import { Ghost, Waypoints, Wrench } from "lucide-react";

const PathwayIcons: Record<PathwayId, React.ReactNode> = {
  analysis: <Waypoints className="w-3 h-3" />,
  execution: <Ghost className="w-3 h-3" />,
  refinement: <Wrench className="w-3 h-3" />,
};

function AnalysisReasoning({ reasoning }: { reasoning: Reasoning }) {
  return (
    <section className="flex flex-col gap-4">
      <p className="text-white/70 max-w-2xl">{reasoning.main_idea}</p>
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
      <div className="flex items-center gap-1">
        {PathwayIcons[analysisType]}
        <h1 className="text-2xl font-bold">
          {PATHWAYSJSON[analysisType].title}
        </h1>
      </div>
      {"reasoning" in analysisData && (
        <ExpandableSection
          title={`Reasoning · ${analysisData.reasoning.reasons.length}`}
          preview={analysisData.reasoning.main_idea}
        >
          <AnalysisReasoning reasoning={analysisData.reasoning} />
        </ExpandableSection>
      )}
      {"summary" in analysisData &&
        analysisData.choices.map((choice, index) => (
          <ExpandableSection
            key={choice.bucket_id}
            title={`Reasoning · ${index + 1}`}
            preview={choice.reasoning.main_idea}
          >
            <AnalysisReasoning reasoning={choice.reasoning} />
          </ExpandableSection>
        ))}
      <ExpandableSection
        title={`Results · ${
          "suggestions" in analysisData
            ? analysisData.suggestions.length
            : analysisData.choices.length
        }`}
        defaultOpen
      >
        <AnalysisResultConditional result={analysisData} type={analysisType} />
      </ExpandableSection>
    </div>
  );
}
