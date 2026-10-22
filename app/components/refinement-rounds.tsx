"use client";

import {
  MAX_REFINEMENT_NOTE_LENGTH,
  MAX_REFINEMENT_ROUNDS,
} from "@/lib/constants";
import type {
  BucketRefinementResult,
  GameplanResult,
  Round,
} from "@/lib/types";
import { HistoryIcon, MessageCircleIcon } from "lucide-react";
import { BucketIcon } from "./bucket-icon";
import { CharCounter } from "./char-counter";

type Draft = BucketRefinementResult | GameplanResult;

// The line or two that identifies a draft in the thread.
function draftSummary(draft: Draft) {
  if ("finish_line" in draft) {
    return {
      title: draft.first_step.title,
      detail: draft.finish_line,
      category: undefined,
    };
  }
  return {
    title: draft.refined_name,
    detail: draft.refined_description,
    category: draft.refined_category,
  };
}

// Earlier drafts and what the user said back to each. Any draft can be
// restored, which drops the rounds after it.
export function RefinementRounds({
  rounds,
  disabled,
  onRestore,
}: {
  rounds: Round<Draft>[];
  disabled: boolean;
  onRestore: (index: number) => void;
}) {
  if (rounds.length === 0) return null;

  return (
    <ol className="flex flex-col gap-3">
      {rounds.map((round, index) => {
        const summary = draftSummary(round.draft);
        return (
          <li
            key={index}
            className="flex flex-col gap-2 rounded-lg border border-white/10 p-3"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex flex-col gap-1 min-w-0">
                <p className="text-xs text-white/40">Draft {index + 1}</p>
                <p className="flex items-center gap-2 text-sm text-white/70">
                  {summary.category && (
                    <BucketIcon
                      category={summary.category}
                      className="w-3 h-3 shrink-0"
                    />
                  )}
                  <span className="truncate">{summary.title}</span>
                </p>
                <p className="text-xs text-white/40 line-clamp-2">
                  {summary.detail}
                </p>
              </div>
              <button
                type="button"
                disabled={disabled}
                onClick={() => onRestore(index)}
                className="action-button shrink-0"
              >
                <HistoryIcon className="w-3 h-3" />
                Go back to this
              </button>
            </div>
            <p className="flex gap-2 text-sm text-white/60 border-t border-white/10 pt-2">
              <MessageCircleIcon className="w-3 h-3 mt-1 shrink-0" />
              {round.feedback}
            </p>
          </li>
        );
      })}
    </ol>
  );
}

export function RefinementReply({
  value,
  roundCount,
  disabled,
  onChange,
  onSubmit,
  placeholder = "e.g. keep the old name, but focus on teachers instead",
}: {
  value: string;
  roundCount: number;
  disabled: boolean;
  onChange: (value: string) => void;
  onSubmit: () => void;
  placeholder?: string;
}) {
  if (roundCount >= MAX_REFINEMENT_ROUNDS) {
    return (
      <p className="text-xs text-white/40">
        That&apos;s {MAX_REFINEMENT_ROUNDS} rounds of back-and-forth. Keep the
        draft you like best, or start fresh.
      </p>
    );
  }

  const canSubmit = !disabled && value.trim().length > 0;

  return (
    <form
      className="flex flex-col gap-2 pt-2 border-t border-white/10"
      onSubmit={(event) => {
        event.preventDefault();
        if (canSubmit) onSubmit();
      }}
    >
      <div className="flex flex-col gap-1">
        <h3 className="text-sm">Not quite? Tell Goblin what to change</h3>
        <p className="text-xs text-white/50">
          Goblin will rework this draft with your reply.
        </p>
      </div>
      <textarea
        aria-label="Reply to this draft"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
            event.preventDefault();
            if (canSubmit) onSubmit();
          }
        }}
        maxLength={MAX_REFINEMENT_NOTE_LENGTH}
        rows={2}
        disabled={disabled}
        placeholder={placeholder}
        className="w-full rounded-md border border-white/15 bg-transparent px-3 py-2 text-sm placeholder:text-white/30 focus:border-white/40 focus:outline-none"
      />
      <div className="flex items-center justify-between gap-2">
        <button
          type="submit"
          disabled={!canSubmit}
          className="action-button w-fit"
        >
          <MessageCircleIcon className="w-3 h-3" />
          Refine again
        </button>
        <CharCounter
          valueLength={value.length}
          maxLength={MAX_REFINEMENT_NOTE_LENGTH}
          className="text-xs"
        />
      </div>
    </form>
  );
}
