"use client";
import type { IdeaBucket, IdeaView } from "@/lib/db/schema";
import type { GameplanResult } from "@/lib/types";
import { FlagIcon, Loader2Icon } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { AnalyzeVaultModal } from "../components/analyze-vault";
import { GameplanView } from "../components/gameplan-view";

type SavedGameplan = { id: number; createdAt: string; data: GameplanResult };

function isSavedGameplan(value: unknown): value is SavedGameplan {
  return (
    typeof value === "object" &&
    value !== null &&
    "data" in value &&
    typeof (value as SavedGameplan).data?.finish_line === "string"
  );
}

// The bucket's latest saved gameplan, checked against its current ideas so
// finished steps show as done.
export default function BucketGameplan({
  bucket,
  ideas,
}: {
  bucket: IdeaBucket;
  ideas: IdeaView[];
}) {
  const [gameplan, setGameplan] = useState<SavedGameplan | null>(null);
  const [loading, setLoading] = useState(true);
  const [planning, setPlanning] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/buckets/gameplan?bucketId=${bucket.id}`)
      .then((response) => (response.ok ? response.json() : null))
      .then((data: unknown) => {
        if (!cancelled) setGameplan(isSavedGameplan(data) ? data : null);
      })
      .catch(() => {
        if (!cancelled) setGameplan(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [bucket.id, reloadKey]);

  return (
    <div className="flex flex-col gap-4 p-4">
      {loading && !gameplan && (
        <p
          aria-live="polite"
          className="flex items-center gap-2 text-sm text-white/50"
        >
          <Loader2Icon className="w-3 h-3 animate-spin" />
          Digging up the gameplan...
        </p>
      )}
      {!loading && !gameplan && (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-white/50">
            No gameplan yet. Goblin can map out how to finish this bucket: a
            finish line, a few phases, and a first step for today.
          </p>
          <button
            type="button"
            onClick={() => setPlanning(true)}
            className="action-button w-fit"
          >
            <FlagIcon className="w-3 h-3" />
            Make a gameplan
          </button>
        </div>
      )}
      {gameplan && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-white/40">
              Saved {new Date(gameplan.createdAt).toLocaleDateString()} ·{" "}
              <Link
                href={`/main/analysis/${gameplan.id}`}
                className="underline hover:text-white/70"
              >
                open
              </Link>
            </p>
            <button
              type="button"
              onClick={() => setPlanning(true)}
              className="action-button"
            >
              <FlagIcon className="w-3 h-3" />
              New gameplan
            </button>
          </div>
          <GameplanView
            result={gameplan.data}
            ideas={ideas}
            bucketId={bucket.id}
          />
        </>
      )}
      {planning && (
        <AnalyzeVaultModal
          scopeBucket={bucket}
          scopePathway="gameplan"
          onClose={() => {
            setPlanning(false);
            setReloadKey((key) => key + 1);
          }}
        />
      )}
    </div>
  );
}
