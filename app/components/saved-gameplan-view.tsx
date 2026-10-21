"use client";

import type { GameplanResult } from "@/lib/types";
import { useState } from "react";
import { GameplanView, type LinkStep } from "./gameplan-view";

// A saved gameplan whose steps, once added as ideas, are linked in the saved
// copy too, so they track done and can't be added twice.
export function SavedGameplanView({
  analysisId,
  result,
  ideas,
  bucketId,
}: {
  analysisId: number;
  result: GameplanResult;
  ideas?: { id: number; title: string; status: string }[];
  bucketId?: number;
}) {
  const [plan, setPlan] = useState(result);

  const link: LinkStep = async (step, ideaId) => {
    const response = await fetch("/api/analysis/link-step", {
      method: "POST",
      body: JSON.stringify({ analysisId, ideaId, step }),
    });
    if (!response.ok) throw new Error("Failed to link step");
    setPlan((await response.json()) as GameplanResult);
  };

  return (
    <GameplanView
      result={plan}
      ideas={ideas}
      bucketId={bucketId}
      onLink={link}
    />
  );
}
