"use client";

import {
  MAX_REFINEMENT_NOTE_LENGTH,
  REFINEMENT_FOCUSES,
  type RefinementFocusId,
} from "@/lib/constants";
import type { BucketOption } from "@/lib/types";
import clsx from "clsx";
import { Loader2, SparklesIcon } from "lucide-react";

export function RefinementPicker({
  buckets,
  loading,
  recommending,
  selectedBucketId,
  recommendReason,
  onSelect,
  onRecommend,
  focus,
  onFocusChange,
  note,
  onNoteChange,
}: {
  buckets: BucketOption[];
  loading: boolean;
  recommending: boolean;
  selectedBucketId: number | null;
  recommendReason?: string;
  onSelect: (bucket: BucketOption) => void;
  // Omitted when the picker is scoped to a single bucket.
  onRecommend?: () => void;
  focus: RefinementFocusId[];
  onFocusChange: (focus: RefinementFocusId[]) => void;
  note: string;
  onNoteChange: (note: string) => void;
}) {
  function toggleFocus(id: RefinementFocusId) {
    onFocusChange(
      focus.includes(id)
        ? focus.filter((current) => current !== id)
        : [...focus, id],
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-2xl font-bold">Choose a bucket</h2>
        <p className="text-sm text-white/50">
          Refinement sharpens one bucket at a time, using the ideas in it as
          context.
          {onRecommend ? " Pick one, or let Goblin recommend." : ""}
        </p>
      </div>
      {onRecommend && (
        <button
          type="button"
          onClick={onRecommend}
          disabled={recommending || loading}
          className="action-button w-fit"
        >
          {recommending ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            <SparklesIcon className="w-3 h-3" />
          )}
          {recommending ? "Asking Goblin..." : "Let Goblin recommend"}
        </button>
      )}
      {recommendReason && (
        <p className="text-sm text-white/60">{recommendReason}</p>
      )}
      {loading ? (
        <p className="text-sm text-white/50">Loading buckets...</p>
      ) : buckets.length === 0 ? (
        <p className="text-sm text-white/50">No buckets in your vault yet.</p>
      ) : (
        <div className="flex flex-col gap-2 max-h-[50vh] overflow-y-auto">
          {buckets.map((bucket) => (
            <button
              key={bucket.id}
              type="button"
              onClick={() => onSelect(bucket)}
              className={clsx(
                "text-left p-3 rounded-md border border-white/15 hover:border-white/40 transition-colors",
                selectedBucketId === bucket.id && "border-white/50 bg-white/5",
              )}
            >
              <p className="text-sm">{bucket.name}</p>
              <p className="text-sm text-white/50 line-clamp-2">
                {bucket.description}
              </p>
            </button>
          ))}
        </div>
      )}
      <div className="flex flex-col gap-2 pt-2 border-t border-white/10">
        <div className="flex flex-col gap-1">
          <h3 className="text-sm">How should Goblin refine it?</h3>
          <p className="text-xs text-white/50">
            Pick any that apply, or none for a general pass.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {REFINEMENT_FOCUSES.map((option) => {
            const selected = focus.includes(option.id);
            return (
              <button
                key={option.id}
                type="button"
                aria-pressed={selected}
                title={option.description}
                onClick={() => toggleFocus(option.id)}
                className={clsx(
                  "text-left px-3 py-2 rounded-md border transition-colors",
                  selected
                    ? "border-green-500/50 bg-green-500/10 text-green-400"
                    : "border-white/15 text-white/70 hover:border-white/40",
                )}
              >
                <span className="block text-sm">{option.label}</span>
                <span className="block text-xs text-white/40">
                  {option.description}
                </span>
              </button>
            );
          })}
        </div>
        <textarea
          aria-label="Refinement note"
          value={note}
          onChange={(event) => onNoteChange(event.target.value)}
          maxLength={MAX_REFINEMENT_NOTE_LENGTH}
          rows={2}
          placeholder="Anything else? e.g. aim it at indie game devs"
          className="w-full rounded-md border border-white/15 bg-transparent px-3 py-2 text-sm placeholder:text-white/30 focus:border-white/40 focus:outline-none"
        />
      </div>
    </div>
  );
}
