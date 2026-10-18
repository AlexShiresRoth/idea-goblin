"use client";

import type { IdeaView } from "@/lib/db/schema";
import clsx from "clsx";
import { Loader2, SparklesIcon } from "lucide-react";

export function RefinementPicker({
  ideas,
  loading,
  recommending,
  selectedIdeaId,
  recommendReason,
  onSelect,
  onRecommend,
}: {
  ideas: IdeaView[];
  loading: boolean;
  recommending: boolean;
  selectedIdeaId: number | null;
  recommendReason?: string;
  onSelect: (idea: IdeaView) => void;
  onRecommend: () => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-2xl font-bold">Choose an idea</h2>
        <p className="text-sm text-white/50">
          Refinement works one idea at a time. Pick one, or let Goblin
          recommend.
        </p>
      </div>
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
      {recommendReason && (
        <p className="text-sm text-white/60">{recommendReason}</p>
      )}
      {loading ? (
        <p className="text-sm text-white/50">Loading ideas...</p>
      ) : ideas.length === 0 ? (
        <p className="text-sm text-white/50">No ideas in your vault yet.</p>
      ) : (
        <div className="flex flex-col gap-2 max-h-[50vh] overflow-y-auto">
          {ideas.map((idea) => (
            <button
              key={idea.id}
              type="button"
              onClick={() => onSelect(idea)}
              className={clsx(
                "text-left p-3 rounded-md border border-white/15 hover:border-white/40 transition-colors",
                selectedIdeaId === idea.id && "border-white/50 bg-white/5",
              )}
            >
              <p className="text-sm">{idea.title}</p>
              <p className="text-sm text-white/50 line-clamp-2">
                {idea.description}
              </p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
