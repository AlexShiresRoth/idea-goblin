"use client";

import type { BucketRefinementResult } from "@/lib/types";
import { CheckIcon, Loader2Icon, SaveIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useContext, useId, useRef, useState } from "react";
import { ToastContext } from "../context/toast.provider";

type Props = {
  result: BucketRefinementResult;
  testId?: string;
  className?: string;
  onApplied?: () => void;
};
type SuggestedIdea = { title: string; description: string };
type IdeasMode = "none" | "add" | "replace";

export function ApplyRefinementButton(props: Props) {
  // Reset the entire interaction when a different result/draft is restored.
  return <ApplyRefinement key={JSON.stringify(props.result)} {...props} />;
}

function ApplyRefinement({ result, testId, className, onApplied }: Props) {
  const router = useRouter();
  const { setToasts } = useContext(ToastContext);
  const dialog = useRef<HTMLDialogElement>(null);
  const inFlight = useRef(false);
  const id = useId();
  // Compatible with older results until the shared type gains suggested_ideas.
  const suggestedIdeas = (
    result as BucketRefinementResult & {
      suggested_ideas?: SuggestedIdea[];
    }
  ).suggested_ideas;
  const suggestions =
    suggestedIdeas ??
    (result.improvements ?? []).map((text) => ({
      title: text.slice(0, 200),
      description: text,
    }));
  const [updateDetails, setUpdateDetails] = useState(true);
  const [ideasMode, setIdeasMode] = useState<IdeasMode>(
    suggestions.length ? "add" : "none",
  );
  const [selected, setSelected] = useState<number[]>(() =>
    suggestions.map((_, index) => index),
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const invalid = ideasMode === "none" ? !updateDetails : selected.length === 0;

  async function apply() {
    if (inFlight.current || saved || invalid) return;
    inFlight.current = true;
    setSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/buckets/apply-refinement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bucketId: result.bucket_id,
          name: result.refined_name,
          description: result.refined_description,
          category: result.refined_category,
          updateDetails,
          ideasMode,
          ideas:
            ideasMode === "none"
              ? []
              : suggestions.filter((_, index) => selected.includes(index)),
        }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(
          body?.error || "Failed to save to bucket. Please try again.",
        );
      }
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Failed to save to bucket. Please try again.",
      );
      return;
    } finally {
      inFlight.current = false;
      setSaving(false);
    }
    setSaved(true);
    dialog.current?.close();
    setToasts([
      {
        id: result.bucket_id,
        message: "Refinement saved to bucket",
        type: "success",
      },
    ]);
    router.refresh();
    onApplied?.();
  }

  return (
    <>
      <button
        type="button"
        data-testid={testId}
        disabled={saving || saved}
        className={
          className ??
          "flex items-center gap-1 text-accent/80 hover:text-accent transition-colors text-sm hover:cursor-pointer disabled:cursor-default disabled:opacity-50"
        }
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
        aria-labelledby={`${id}-title`}
        aria-describedby={`${id}-description`}
        aria-busy={saving}
        className="m-auto max-h-[85dvh] w-11/12 max-w-xl overflow-y-auto border border-accent/40 bg-background p-5 text-primary backdrop:bg-background/70"
        onCancel={(event) => {
          if (inFlight.current) event.preventDefault();
        }}
      >
        <div className="flex flex-col gap-4">
          <h2 id={`${id}-title`} className="text-lg font-bold">
            Save to {result.original_name}?
          </h2>
          <p id={`${id}-description`} className="text-sm text-white/60">
            Choose what to apply. The bucket’s current version will be saved in
            version history.
          </p>
          <fieldset
            disabled={saving}
            className="flex flex-col gap-4 disabled:opacity-60"
          >
            <legend className="sr-only">Refinement options</legend>
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                className="mt-1 accent-accent"
                checked={updateDetails}
                onChange={(event) => setUpdateDetails(event.target.checked)}
              />
              Update bucket name, description, and category
            </label>
            <div className="border border-white/20 p-3 text-sm">
              <p className="font-bold break-words">{result.refined_name}</p>
              <p className="whitespace-pre-wrap break-words text-white/60">
                {result.refined_description}
              </p>
              {result.refined_category && (
                <p className="text-accent">{result.refined_category}</p>
              )}
            </div>
            <fieldset className="flex flex-col gap-2 text-sm">
              <legend className="mb-2 font-bold">Ideas</legend>
              {(
                [
                  ["none", "Keep current ideas (details only)"],
                  ["add", "Add selected ideas"],
                  ["replace", "Replace current ideas with selected ideas"],
                ] as const
              ).map(([mode, label]) => (
                <label key={mode} className="flex items-start gap-2">
                  <input
                    type="radio"
                    name={`${id}-mode`}
                    value={mode}
                    className="mt-1 accent-accent"
                    checked={ideasMode === mode}
                    onChange={() => setIdeasMode(mode)}
                  />
                  {label}
                </label>
              ))}
            </fieldset>
            {ideasMode === "replace" && (
              <p
                role="note"
                className="border border-accent p-3 text-sm text-accent"
              >
                Replace removes ALL current ideas from this bucket, including
                completed ideas. The current version is saved in version
                history. Original ideas in other buckets remain unchanged.
              </p>
            )}
            {suggestedIdeas === undefined && suggestions.length > 0 && (
              <p className="text-sm text-white/60">
                This older result uses improvements as suggested ideas.
              </p>
            )}
            <fieldset
              disabled={ideasMode === "none"}
              className="flex flex-col gap-2 disabled:opacity-50"
            >
              <legend className="mb-2 text-sm font-bold">
                Suggested ideas
              </legend>
              {suggestions.length === 0 && (
                <p className="text-sm text-white/60">
                  No suggested ideas in this result.
                </p>
              )}
              {suggestions.map((idea, index) => (
                <label
                  key={index}
                  className="flex items-start gap-2 border border-white/20 p-3 text-sm"
                >
                  <input
                    type="checkbox"
                    className="mt-1 accent-accent"
                    aria-labelledby={`${id}-idea-${index}`}
                    aria-describedby={`${id}-idea-description-${index}`}
                    checked={selected.includes(index)}
                    onChange={(event) =>
                      setSelected((current) =>
                        event.target.checked
                          ? [...current, index]
                          : current.filter((item) => item !== index),
                      )
                    }
                  />
                  <span className="min-w-0">
                    <span
                      id={`${id}-idea-${index}`}
                      className="block font-bold break-words"
                    >
                      {idea.title}
                    </span>
                    <span
                      id={`${id}-idea-description-${index}`}
                      className="block whitespace-pre-wrap break-words text-white/60"
                    >
                      {idea.description}
                    </span>
                  </span>
                </label>
              ))}
            </fieldset>
          </fieldset>
          {invalid && (
            <p className="text-sm text-accent">
              {ideasMode === "none"
                ? "Select bucket details or ideas to apply."
                : "Select at least one suggested idea to add or replace."}
            </p>
          )}
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
              onClick={() => {
                if (!inFlight.current) dialog.current?.close();
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              className="action-button text-accent disabled:opacity-50"
              disabled={saving || invalid}
              onClick={apply}
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
