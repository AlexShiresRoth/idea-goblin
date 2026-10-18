"use client";

import type {
  AnalysisPayload,
  AnalysisResult,
  ExecutionResult,
  IdeaRefinementResult,
  PathwayId,
  RefinementResult,
} from "@/lib/types";
import { isIdeaRefinement } from "@/lib/types";
import clsx from "clsx";
import { ChevronDown, ScanHeart } from "lucide-react";
import { useState } from "react";

function scoreTone(score: number) {
  if (score >= 75)
    return "border-green-500/40 bg-green-500/10 text-green-500/80";
  if (score > 50)
    return "border-yellow-500/40 bg-yellow-500/10 text-yellow-500/80";
  if (score > 25)
    return "border-orange-500/40 bg-orange-500/10 text-orange-500/80";
  return "border-red-500/40 bg-red-500/10 text-red-500/80";
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

function JustificationToggle({
  justifications,
}: {
  justifications: string;
}) {
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
          className={clsx(
            "w-3 h-3 transition-transform",
            open && "rotate-180",
          )}
        />
      </button>
      {open && (
        <p className="text-sm text-white/60 mt-2">{justifications}</p>
      )}
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

const recommendationOrder = { pursue: 0, park: 1, kill: 2 } as const;

export function ExecutionChoiceCard({
  choice,
  className,
}: {
  choice: ExecutionResult["choices"][number];
  className?: string;
}) {
  const title =
    choice.title ?? choice.main_idea ?? choice.reasoning?.main_idea;
  const mainIdea =
    choice.title && choice.main_idea ? choice.main_idea : undefined;

  return (
    <div
      className={clsx(
        "flex flex-col items-start gap-2",
        className,
      )}
    >
      <div className="flex items-center gap-2 flex-wrap">
        {choice.score != null && (
          <ScoreChip value={choice.score} label="value" />
        )}
        <ScoreChip value={choice.feasibility} label="feasibility" />
      </div>
      <p className="text-sm capitalize text-white/70">
        {choice.recommendation} · {choice.estimated_effort} effort
      </p>
      <h2 className="text-lg font-bold">{title}</h2>
      {mainIdea && <p className="text-white/70">{mainIdea}</p>}
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

export function IdeaRefinementCard({
  result,
}: {
  result: IdeaRefinementResult;
}) {
  return (
    <div className="flex flex-col gap-4 p-4 border border-white/20 rounded-md">
      <div className="flex flex-col gap-1">
        <span className="text-xs uppercase tracking-wide text-white/40">
          Original
        </span>
        <p className="text-sm text-white/60">{result.original_title}</p>
        <p className="text-sm text-white/50">{result.original_idea}</p>
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-xs uppercase tracking-wide text-white/40">
          Refined
        </span>
        <h2 className="text-lg font-bold">{result.refined_title}</h2>
        <p className="text-white/70">{result.refined_idea}</p>
      </div>
      {result.improvements.length > 0 && (
        <ul className="flex flex-col gap-2">
          {result.improvements.map((improvement, index) => (
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
  if (isIdeaRefinement(result)) {
    return <IdeaRefinementCard result={result} />;
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
    case "analysis":
      return <AnalysisChoices result={result as AnalysisResult} />;
    case "execution":
      return <ExecutionChoices result={result as ExecutionResult} />;
    case "refinement":
      return <RefinementSuggestions result={result as RefinementResult} />;
  }
}
