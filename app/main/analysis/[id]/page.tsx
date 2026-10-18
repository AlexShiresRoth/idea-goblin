import { AnalysisResultConditional } from "@/app/components/analysis-result-condition";
import { getAnalysisResult } from "@/lib/api/analysis";
import { PATHWAYSJSON } from "@/lib/constants";

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

  console.log(analysis);
  return (
    <div className="p-4 flex flex-col gap-4 flex-1 w-full">
      <div>
        <h1 className="text-2xl font-bold">
          {PATHWAYSJSON[analysis.analysisType].title}
        </h1>
      </div>
      <AnalysisResultConditional
        result={analysis.analysisData}
        type={analysis.analysisType}
      />
    </div>
  );
}
