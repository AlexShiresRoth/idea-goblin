"use client";

import type {
  AnalysisPayload,
  AnalysisResult,
  ExecutionResult,
  BucketRefinementResult,
  IdeaRefinementResult,
  PathwayId,
  RefinementResult,
} from "@/lib/types";
import { isBucketRefinement, isIdeaRefinement } from "@/lib/types";
import clsx from "clsx";
import { ChevronDown, ScanHeart } from "lucide-react";
import { useState } from "react";
import { BucketIcon } from "./bucket-icon";

function scoreTone(score: number) {
  if (score >= 75)
    return "border-green-500/40 bg-green-500/10 text-green-500/80";
  if (score > 50)
    return "border-yellow-500/40 bg-yellow-500/10 text-yellow-500/80";
  if (score > 25)
    return "border-orange-500/40 bg-orange-500/10 text-orange-500/80";
  return "border-red-500/40 bg-red-500/10 text-red-500/80";
}

function scoreTextTone(score: number) {
  if (score >= 75) return "text-green-500/90";
  if (score > 50) return "text-yellow-500/90";
  if (score > 25) return "text-orange-500/90";
  return "text-red-500/90";
}

const effortLevel = { low: 1, medium: 2, high: 3 } as const;

function MetricLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[10px] uppercase tracking-wide text-white/40">
      {children}
    </span>
  );
}

// Value leads, feasibility backs it up, effort is context: sized to match.
function ExecutionMetrics({
  choice,
}: {
  choice: ExecutionResult["choices"][number];
}) {
  const effort = effortLevel[choice.estimated_effort];

  return (
    <div className="grid grid-cols-3 gap-3 w-full pt-3 border-t border-white/10">
      <div className="flex flex-col gap-1">
        <MetricLabel>Value</MetricLabel>
        {choice.score != null ? (
          <span
            className={clsx(
              "text-3xl font-semibold leading-none",
              scoreTextTone(choice.score),
            )}
          >
            {choice.score}
          </span>
        ) : (
          <span className="text-3xl leading-none text-white/30">–</span>
        )}
      </div>
      <div className="flex flex-col gap-1">
        <MetricLabel>Feasibility</MetricLabel>
        <span className="text-lg leading-none text-white/80">
          {choice.feasibility}
        </span>
        <div className="h-1 w-full max-w-20 rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-white/50"
            style={{
              width: `${Math.min(100, Math.max(0, choice.feasibility))}%`,
            }}
          />
        </div>
      </div>
      <div className="flex flex-col gap-1">
        <MetricLabel>Effort</MetricLabel>
        <span className="text-sm capitalize leading-none text-white/60">
          {choice.estimated_effort}
        </span>
        <div
          className="flex gap-1"
          aria-label={`${choice.estimated_effort} effort`}
        >
          {[1, 2, 3].map((level) => (
            <span
              key={level}
              className={clsx(
                "h-1.5 w-1.5 rounded-full",
                level <= effort ? "bg-white/60" : "bg-white/15",
              )}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function ScoreChip({ value, label }: { value: number; label?: string }) {
  return (
    <div
      className={clsx(
        "flex items-center gap-1 border rounded p-1",
        scoreTone(value),
      )}
    >
      {label && <span className="text-xs px-1">{label}</span>}
      <span className="text-xl">{value}</span>
    </div>
  );
}

function JustificationToggle({ justifications }: { justifications: string }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="w-full">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="flex items-center gap-1 text-sm text-white/50 hover:text-white/80 transition-colors"
      >
        Justifications
        <ChevronDown
          className={clsx("w-3 h-3 transition-transform", open && "rotate-180")}
        />
      </button>
      {open && <p className="text-sm text-white/60 mt-2">{justifications}</p>}
    </div>
  );
}

export function AnalysisItem({
  choice,
}: {
  choice: AnalysisResult["choices"][number];
}) {
  return (
    <div
      key={choice.bucket_id}
      className="p-4 border border-white/20 rounded-md flex flex-col items-start gap-2 max-w-sm animate-fade-in flex-1 min-w-xs"
    >
      <div className="flex items-center justify-between w-full gap-1">
        <ScoreChip value={choice.score} />
        <span>
          <ScanHeart className="w-3 h-3" />
        </span>
      </div>
      <p className="text-white/70">{choice.main_idea}</p>
      <JustificationToggle justifications={choice.justifications} />
    </div>
  );
}

const recommendationOrder = { pursue: 0, park: 1, kill: 2 } as const;

const recommendationTone = {
  pursue: "border-green-500/40 bg-green-500/10 text-green-500/80",
  park: "border-yellow-500/40 bg-yellow-500/10 text-yellow-500/80",
  kill: "border-red-500/40 bg-red-500/10 text-red-500/80",
} as const;

export function RecommendationBadge({
  recommendation,
}: {
  recommendation: keyof typeof recommendationTone;
}) {
  return (
    <span
      className={clsx(
        "shrink-0 border rounded px-2 py-0.5 text-xs uppercase tracking-wide",
        recommendationTone[recommendation],
      )}
    >
      {recommendation}
    </span>
  );
}

export function ExecutionChoiceCard({
  choice,
  className,
}: {
  choice: ExecutionResult["choices"][number];
  className?: string;
}) {
  const title = choice.title ?? choice.main_idea ?? choice.reasoning?.main_idea;
  const mainIdea =
    choice.title && choice.main_idea ? choice.main_idea : undefined;

  return (
    <div className={clsx("flex flex-col items-start gap-3", className)}>
      <div className="flex flex-col gap-1">
        <div className="flex items-start gap-2">
          <span className="mt-1">
            <RecommendationBadge recommendation={choice.recommendation} />
          </span>
          <h2 className="text-lg font-bold">{title}</h2>
        </div>
        {mainIdea && <p className="text-sm text-white/70">{mainIdea}</p>}
      </div>
      <ExecutionMetrics choice={choice} />
      {choice.justifications && (
        <JustificationToggle justifications={choice.justifications} />
      )}
    </div>
  );
}

function ExecutionChoices({ result }: { result: ExecutionResult }) {
  const sortedChoices = [...result.choices].sort((a, b) => {
    const rank =
      recommendationOrder[a.recommendation] -
      recommendationOrder[b.recommendation];
    if (rank !== 0) return rank;
    return (b.score ?? 0) - (a.score ?? 0);
  });

  return (
    <div className="flex items-stretch flex-wrap p-4 border border-white/20 rounded-md gap-4">
      {sortedChoices.map((choice) => (
        <ExecutionChoiceCard
          key={choice.bucket_id}
          choice={choice}
          className="p-4 border border-white/20 rounded-md max-w-sm flex-1 min-w-xs"
        />
      ))}
    </div>
  );
}

function refinementFields(
  result: IdeaRefinementResult | BucketRefinementResult,
) {
  return isBucketRefinement(result)
    ? {
        originalTitle: result.original_name,
        originalText: result.original_description,
        refinedTitle: result.refined_name,
        refinedText: result.refined_description,
        refinedCategory: result.refined_category,
        improvements: result.improvements,
      }
    : {
        originalTitle: result.original_title,
        originalText: result.original_idea,
        refinedTitle: result.refined_title,
        refinedText: result.refined_idea,
        refinedCategory: undefined,
        improvements: result.improvements,
      };
}

export function RefinementCard({
  result,
}: {
  result: IdeaRefinementResult | BucketRefinementResult;
}) {
  const fields = refinementFields(result);

  return (
    <div className="flex flex-col gap-4 p-4 border border-white/20 rounded-md">
      <div className="flex flex-col gap-1">
        <span className="text-xs uppercase tracking-wide text-white/40">
          Original
        </span>
        <p className="text-sm text-white/60">{fields.originalTitle}</p>
        <p className="text-sm text-white/50">{fields.originalText}</p>
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-xs uppercase tracking-wide text-white/40">
          Refined
        </span>
        <h2 className="flex items-center gap-2 text-lg font-bold">
          {fields.refinedCategory && (
            <BucketIcon category={fields.refinedCategory} className="w-4 h-4" />
          )}
          {fields.refinedTitle}
        </h2>
        <p className="text-white/70">{fields.refinedText}</p>
      </div>
      {fields.improvements.length > 0 && (
        <ul className="flex flex-col gap-2">
          {fields.improvements.map((improvement, index) => (
            <li
              key={`${improvement}-${index}`}
              className="text-sm text-white/60 rounded-lg bg-white/5 px-4 py-3 border-l-2 border-white/30"
            >
              {improvement}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function RefinementSuggestions({ result }: { result: RefinementResult }) {
  if (isIdeaRefinement(result) || isBucketRefinement(result)) {
    return <RefinementCard result={result} />;
  }

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
    case "execution":
      return <ExecutionChoices result={result as ExecutionResult} />;
    case "refinement":
      return <RefinementSuggestions result={result as RefinementResult} />;
  }
}
