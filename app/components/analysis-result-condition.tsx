import type {
  AnalysisPayload,
  AnalysisResult,
  ExecutionResult,
  PathwayId,
  RefinementResult,
} from "@/lib/types";
import clsx from "clsx";
import { ScanHeart } from "lucide-react";

export function AnalysisItem({
  choice,
}: {
  choice: AnalysisResult["choices"][number];
}) {
  const score = choice.score;
  return (
    <div
      key={choice.bucket_id}
      className="p-4 border border-white/20 rounded-md flex flex-col items-start gap-2 max-w-sm animate-fade-in flex-1 min-w-xs"
    >
      <div className="flex items-center justify-between w-full gap-1">
        <div
          className={clsx(
            " flex items-center gap-1 border rounded p-1",
            score >= 75 &&
              "border-green-500/40 bg-green-500/10 text-green-500/80",
            score > 50 &&
              score < 75 &&
              "border-yellow-500/40 bg-yellow-500/10 text-yellow-500/80",
            score > 25 &&
              score < 50 &&
              "border-orange-500/40 bg-orange-500/10 text-orange-500/80",
            score >= 0 &&
              score < 25 &&
              "border-red-500/40 bg-red-500/10 text-red-500/80",
          )}
        >
          <span className="text-xl"> {choice.score}</span>
        </div>
        <span>
          <ScanHeart className="w-3 h-3" />
        </span>
      </div>
      <h2 className="text-lg font-bold">{choice.main_idea}</h2>
      <p className="text-sm text-white/60">{choice.justifications}</p>
    </div>
  );
}

function AnalysisChoices({ result }: { result: AnalysisResult }) {
  const sortedChoices = [...result.choices].sort((a, b) => b.score - a.score);

  return (
    <div className="flex items-stretch flex-wrap p-4 border border-white/20 rounded-md gap-4">
      {sortedChoices.map((choice) => {
        return <AnalysisItem key={choice.bucket_id} choice={choice} />;
      })}
    </div>
  );
}

function ExecutionChoices({ result }: { result: ExecutionResult }) {
  return (
    <div className="flex items-stretch flex-wrap p-4 border border-white/20 rounded-md gap-4">
      {result.choices.map((choice) => {
        return (
          <div
            key={choice.bucket_id}
            className="p-4 border border-white/20 rounded-md flex flex-col items-start gap-2 max-w-sm flex-1 min-w-xs"
          >
            <p className="text-sm text-white/60">
              Feasibility {choice.feasibility} · {choice.estimated_effort} effort
            </p>
            <p className="text-lg font-bold">{choice.recommendation}</p>
            <p className="text-sm text-white/60">{choice.reasoning.main_idea}</p>
          </div>
        );
      })}
    </div>
  );
}

function RefinementSuggestions({ result }: { result: RefinementResult }) {
  return (
    <div className="flex items-stretch flex-wrap p-4 border border-white/20 rounded-md gap-4">
      {result.suggestions.map((suggestion) => {
        return (
          <div
            key={suggestion.bucket_id}
            className="p-4 border border-white/20 rounded-md flex flex-col items-start gap-2 max-w-sm flex-1 min-w-xs"
          >
            <p className="text-sm text-white/60">{suggestion.original_idea}</p>
            <h2 className="text-lg font-bold">{suggestion.refined_idea}</h2>
            <p className="text-sm text-white/60">
              {suggestion.improvements.join(" · ")}
            </p>
          </div>
        );
      })}
    </div>
  );
}

export function AnalysisResultConditional({
  result,
  type,
}: {
  result: AnalysisPayload;
  type: PathwayId;
}) {
  switch (type) {
    case "analysis":
      return <AnalysisChoices result={result as AnalysisResult} />;
    case "execution":
      return <ExecutionChoices result={result as ExecutionResult} />;
    case "refinement":
      return <RefinementSuggestions result={result as RefinementResult} />;
  }
}
