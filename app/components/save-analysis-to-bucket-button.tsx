"use client";

import type { AnalysisPayload, GameplanResult, PathwayId } from "@/lib/types";
import { isBucketRefinement, isGameplan } from "@/lib/types";
import { CheckIcon, Loader2Icon, SaveIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useContext, useId, useRef, useState } from "react";
import { ToastContext } from "../context/toast.provider";
import { ApplyRefinementButton } from "./apply-refinement-button";

export function SaveAnalysisToBucketButton({
  analysisId,
  analysisType,
  result,
}: {
  analysisId: number;
  analysisType: PathwayId;
  result: AnalysisPayload;
}) {
  if (
    !(
      (analysisType === "refinement" && isBucketRefinement(result)) ||
      (analysisType === "gameplan" && isGameplan(result))
    ) ||
    !Number.isInteger(result.bucket_id) ||
    result.bucket_id <= 0
  )
    return null;

  if (isBucketRefinement(result)) {
    return (
      <ApplyRefinementButton result={result} testId="save-analysis-to-bucket" />
    );
  }
  return <SaveButton analysisId={analysisId} result={result} />;
}

function SaveButton({
  analysisId,
  result,
}: {
  analysisId: number;
  result: GameplanResult;
}) {
  const router = useRouter();
  const { setToasts } = useContext(ToastContext);
  const dialog = useRef<HTMLDialogElement>(null);
  const inFlight = useRef(false);
  const titleId = useId();
  const descriptionId = useId();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bucketName = result.bucket_name;

  async function save() {
    if (inFlight.current || saved) return;
    inFlight.current = true;
    setSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/analysis/save-to-bucket", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ analysisId }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(
          body?.error || "Failed to save to bucket. Please try again.",
        );
      }
      setSaved(true);
      dialog.current?.close();
      setToasts([
        {
          id: analysisId,
          message: "Gameplan saved to bucket",
          type: "success",
        },
      ]);
      router.refresh();
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Failed to save to bucket. Please try again.",
      );
    } finally {
      inFlight.current = false;
      setSaving(false);
    }
  }

  return (
    <>
      <button
        type="button"
        data-testid="save-analysis-to-bucket"
        disabled={saving || saved}
        className="flex items-center gap-1 text-accent/80 hover:text-accent transition-colors text-sm hover:cursor-pointer disabled:cursor-default disabled:opacity-50"
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setError(null);
          dialog.current?.showModal();
        }}
      >
        {saved ? (
          <CheckIcon className="w-3 h-3" />
        ) : (
          <SaveIcon className="w-3 h-3" />
        )}
        {saved ? "Saved to bucket" : "Save to bucket"}
      </button>
      <dialog
        ref={dialog}
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        className="m-auto w-11/12 max-w-sm border border-white/20 bg-background p-5 text-primary backdrop:bg-background/70"
        onCancel={(event) => {
          if (inFlight.current) event.preventDefault();
        }}
      >
        <div className="flex flex-col gap-4">
          <h2 id={titleId} className="text-lg font-bold">
            Save to {bucketName}?
          </h2>
          <p id={descriptionId} className="text-sm text-white/60">
            This becomes the bucket’s current gameplan. Any previous gameplan
            stays in your analysis history.
          </p>
          {error && (
            <p role="alert" className="text-sm text-red-400">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              className="action-button"
              disabled={saving}
              onClick={() => dialog.current?.close()}
            >
              Cancel
            </button>
            <button
              type="button"
              className="action-button text-accent disabled:opacity-50"
              disabled={saving}
              onClick={save}
            >
              {saving && <Loader2Icon className="w-3 h-3 animate-spin" />}
              {saving ? "Saving..." : "Confirm save"}
            </button>
          </div>
        </div>
      </dialog>
    </>
  );
}
