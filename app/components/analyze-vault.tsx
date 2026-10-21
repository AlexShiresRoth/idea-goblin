"use client";
import { PATHWAYSJSON, type RefinementFocusId } from "@/lib/constants";
import type {
  AnalysisPayload,
  BucketOption,
  Pathway,
  PathwayId,
  Reasoning,
  BucketRefinementResult,
  GameplanResult,
  Round,
} from "@/lib/types";
import { isBucketRefinement, isGameplan } from "@/lib/types";
import clsx from "clsx";
import {
  Brain,
  Ghost,
  Loader2,
  MaximizeIcon,
  MinimizeIcon,
  PencilIcon,
  Route,
  SaveIcon,
  SparklesIcon,
  Wrench,
  Flag,
  XIcon,
} from "lucide-react";
import { useContext, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { linkStep } from "@/lib/gameplan";
import { readNdjson } from "@/lib/ndjson";
import { ToastContext } from "../context/toast.provider";
import ActionButton from "./action-button";
import { AnalysisResultConditional } from "./analysis-result-condition";
import { type AnalysisStep, AnalysisSteps } from "./analysis-steps";
import { GameplanView, type LinkStep } from "./gameplan-view";
import { RefinementPicker } from "./refinement-picker";
import { RefinementReply, RefinementRounds } from "./refinement-rounds";

// A draft the user can reply to: a bucket refinement or a gameplan.
type Draft = BucketRefinementResult | GameplanResult;

const ExecutionPathway = PATHWAYSJSON.execution;
const RefinementPathway = PATHWAYSJSON.refinement;
const GameplanPathway = PATHWAYSJSON.gameplan;

function formatReasoning(reasoning: Reasoning | undefined): string | undefined {
  if (!reasoning) return undefined;
  const lines: string[] = [];
  if (reasoning.main_idea) lines.push(reasoning.main_idea);
  for (const reason of reasoning.reasons ?? []) {
    const line = [reason.title, reason.reasoning].filter(Boolean).join(": ");
    if (line) lines.push(line);
  }
  return lines.length > 0 ? lines.join("\n") : undefined;
}

function getReasoningText(
  result: AnalysisPayload | null,
  pathwayId?: PathwayId,
): string | undefined {
  if (!result || !pathwayId) return undefined;

  switch (pathwayId) {
    case "execution": {
      const parts: string[] = [];
      if ("summary" in result && result.summary) {
        parts.push(result.summary);
      }
      if ("choices" in result) {
        for (const choice of result.choices) {
          if (!("reasoning" in choice)) continue;
          const text = formatReasoning(choice.reasoning);
          if (text) parts.push(text);
        }
      }
      return parts.length > 0 ? parts.join("\n\n") : undefined;
    }
    case "analysis":
    case "refinement":
      return "reasoning" in result
        ? formatReasoning(result.reasoning)
        : undefined;
    case "gameplan":
      return undefined;
  }
}

const PATHWAYS: Pathway[] = [
  {
    id: ExecutionPathway.id,
    title: ExecutionPathway.title,
    description: ExecutionPathway.description,
    icon: <Ghost className="w-3 h-3" />,
  },
  {
    id: RefinementPathway.id,
    title: RefinementPathway.title,
    description: RefinementPathway.description,
    icon: <Wrench className="w-3 h-3" />,
  },
  {
    id: GameplanPathway.id,
    title: GameplanPathway.title,
    description: GameplanPathway.description,
    icon: <Flag className="w-3 h-3" />,
  },
];

// Pathways that work on one bucket, picked before the run starts.
type BucketPathwayId = "refinement" | "gameplan";

function isBucketPathway(id?: PathwayId): id is BucketPathwayId {
  return id === "refinement" || id === "gameplan";
}

// With `scopeBucket`, the modal opens straight on the bucket picker for
// `scopePathway`, limited to that bucket and with it preselected.
export function AnalyzeVaultModal({
  onClose,
  scopeBucket,
  scopePathway = "refinement",
}: {
  onClose: () => void;
  scopeBucket?: BucketOption;
  scopePathway?: BucketPathwayId;
}) {
  const scoped = scopeBucket != null;
  const router = useRouter();
  const { setToasts } = useContext(ToastContext);
  const [selectedPathway, setSelectedPathway] = useState<Pathway | null>(() =>
    scoped
      ? (PATHWAYS.find((pathway) => pathway.id === scopePathway) ?? null)
      : null,
  );
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<AnalysisPayload | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  // The saved copy of this result, so later gameplan links update it too.
  const [savedId, setSavedId] = useState<number | null>(null);
  const [applying, setApplying] = useState(false);
  const [applied, setApplied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showReasoning, setShowReasoning] = useState(false);
  const [minMaxModal, setMinMaxModal] = useState(scoped);
  const [pickingBucket, setPickingBucket] = useState(scoped);
  const [buckets, setBuckets] = useState<BucketOption[]>(
    scopeBucket ? [scopeBucket] : [],
  );
  const [bucketsLoading, setBucketsLoading] = useState(false);
  const [selectedBucket, setSelectedBucket] = useState<BucketOption | null>(
    scopeBucket ?? null,
  );
  const [focus, setFocus] = useState<RefinementFocusId[]>([]);
  const [note, setNote] = useState("");
  // Earlier drafts of this run and the user's reply to each.
  const [rounds, setRounds] = useState<Round<Draft>[]>([]);
  const [reply, setReply] = useState("");
  const [recommending, setRecommending] = useState(false);
  const [recommendReason, setRecommendReason] = useState<string>();
  const [cached, setCached] = useState(false);
  const [steps, setSteps] = useState<AnalysisStep[]>([]);
  const reasoning = useMemo(
    () => getReasoningText(result, selectedPathway?.id),
    [result, selectedPathway?.id],
  );
  const refinement =
    result && selectedPathway?.id === "refinement" && isBucketRefinement(result)
      ? result
      : null;
  const gameplan =
    result && selectedPathway?.id === "gameplan" && isGameplan(result)
      ? result
      : null;
  // A finished draft the user can reply to.
  const draft: Draft | null = refinement ?? gameplan;

  async function loadBuckets() {
    setBucketsLoading(true);
    try {
      const response = await fetch("/api/buckets/list");
      if (!response.ok) throw new Error("Failed to load buckets");
      setBuckets((await response.json()) as BucketOption[]);
    } catch (err) {
      console.error(err);
      setError("Failed to load buckets");
    } finally {
      setBucketsLoading(false);
    }
  }

  async function beginPathway() {
    if (!selectedPathway) return;
    if (isBucketPathway(selectedPathway.id)) {
      setPickingBucket(true);
      setMinMaxModal(true);
      setSelectedBucket(null);
      setRecommendReason(undefined);
      await loadBuckets();
      return;
    }
    await startAnalysis();
  }

  async function recommendBucket() {
    setRecommending(true);
    setError(null);
    try {
      const response = await fetch("/api/vault/recommend", { method: "POST" });
      if (!response.ok) throw new Error("Failed to recommend a bucket");
      const data = (await response.json()) as {
        bucketId: number;
        name: string;
        description: string;
        reason: string;
      };
      const bucket = buckets.find((item) => item.id === data.bucketId) ?? {
        id: data.bucketId,
        name: data.name,
        description: data.description,
        theme: "",
      };
      setSelectedBucket(bucket);
      setRecommendReason(data.reason);
    } catch (err) {
      console.error(err);
      setError("Failed to recommend a bucket");
    } finally {
      setRecommending(false);
    }
  }

  // `nextRounds` continues a run from its latest draft; a fresh run starts
  // with none.
  async function startAnalysis(nextRounds: Round<Draft>[] = []) {
    if (!selectedPathway) return;
    if (isBucketPathway(selectedPathway.id) && !selectedBucket) return;

    setRounds(nextRounds);
    setSavedId(null);
    setPickingBucket(false);
    setAnalyzing(true);
    setResult(null);
    setSaved(false);
    setApplied(false);
    setError(null);
    setCached(false);
    setSteps([]);
    setMinMaxModal(true);
    try {
      const response = await fetch("/api/vault/analyze", {
        method: "POST",
        body: JSON.stringify({
          pathway: selectedPathway.id,
          bucketId: selectedBucket?.id,
          ...(selectedPathway.id === "refinement" && { focus }),
          ...(isBucketPathway(selectedPathway.id) && {
            note: note.trim() || undefined,
            ...(nextRounds.length > 0 && { rounds: nextRounds }),
          }),
        }),
      });

      if (response.status === 429) {
        setError(await response.text());
        return;
      }

      if (!response.ok) {
        throw new Error("Failed to start analysis");
      }

      await readNdjson<{
        type: "status" | "partial" | "done" | "error";
        step?: string;
        data?: unknown;
        message?: string;
        cached?: boolean;
      }>(response, (event) => {
        if (event.type === "status" && event.step && event.message) {
          const { step, message } = event;
          setSteps((current) =>
            current.some((item) => item.step === step)
              ? current.map((item) =>
                  item.step === step ? { ...item, message } : item,
                )
              : [...current, { step, message, startedAt: Date.now() }],
          );
        }

        if (event.type === "partial" || event.type === "done") {
          setResult(event.data as AnalysisPayload);
        }
        if (event.cached) setCached(true);
        if (event.type === "error") {
          setError(event.message ?? "Analysis failed");
        }
      });
    } catch (err) {
      console.error(err);
      setError("Failed to start analysis");
    } finally {
      setAnalyzing(false);
    }
  }

  const saveAnalysis = async () => {
    if (!result || !selectedPathway || saved || saving) return;
    setSaving(true);
    try {
      const response = await fetch("/api/vault/save", {
        method: "POST",
        body: JSON.stringify({
          data: result,
          analysisType: selectedPathway.id,
          // A gameplan belongs to its bucket, which shows the latest one.
          ...(gameplan && { bucketId: gameplan.bucket_id }),
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to save analysis");
      }
      const body = (await response.json().catch(() => null)) as {
        id?: number;
      } | null;
      setSavedId(body?.id ?? null);

      setSaved(true);
      setToasts([
        {
          id: `saved-${selectedPathway.id}-${Date.now()}`,
          message: `${selectedPathway.title} stashed in the hoard`,
          type: "success",
        },
      ]);
    } catch (err) {
      console.error(err);
      setError("Failed to save analysis");
      setToasts([
        {
          id: `save-error-${selectedPathway.id}-${Date.now()}`,
          message: "Failed to save analysis",
          type: "error",
        },
      ]);
    } finally {
      setSaving(false);
    }
  };

  async function applyRefinement() {
    if (!refinement || applied || applying) return;
    setApplying(true);
    try {
      const response = await fetch("/api/buckets/update", {
        method: "POST",
        body: JSON.stringify({
          bucketId: refinement.bucket_id,
          name: refinement.refined_name,
          description: refinement.refined_description,
          category: refinement.refined_category,
        }),
      });
      if (!response.ok) throw new Error("Failed to update bucket");
      setApplied(true);
      setToasts([
        {
          id: `applied-${refinement.bucket_id}`,
          message: "Bucket polished up. The old one is kept in its versions.",
          type: "success",
        },
      ]);
      router.refresh();
    } catch (err) {
      console.error(err);
      setToasts([
        {
          id: `apply-error-${refinement.bucket_id}`,
          message: "Failed to update the bucket",
          type: "error",
        },
      ]);
    } finally {
      setApplying(false);
    }
  }

  function refineAgain() {
    const feedback = reply.trim();
    if (!draft || !feedback || analyzing) return;
    setReply("");
    void startAnalysis([...rounds, { draft, feedback }]);
  }

  // Makes an earlier draft current again, dropping the rounds after it.
  function restoreDraft(index: number) {
    const round = rounds[index];
    if (!round || analyzing) return;
    setResult(round.draft);
    setRounds(rounds.slice(0, index));
    setSaved(false);
    setSavedId(null);
    setApplied(false);
    setCached(false);
    setError(null);
    setSteps([]);
  }

  // A step added as an idea is linked in the plan shown here, and in the
  // saved copy once there is one.
  const linkGameplanStep: LinkStep = async (step, ideaId) => {
    if (!gameplan) return;
    if (savedId == null) {
      setResult(linkStep(gameplan, step, ideaId));
      return;
    }
    const response = await fetch("/api/analysis/link-step", {
      method: "POST",
      body: JSON.stringify({ analysisId: savedId, ideaId, step }),
    });
    if (!response.ok) throw new Error("Failed to link step");
    setResult((await response.json()) as GameplanResult);
  };

  const runStarted = analyzing || result != null || pickingBucket;

  return createPortal(
    <div className="fixed inset-0 bg-black/50 flex justify-center items-center z-999">
      <div
        className={clsx(
          "flex flex-col gap-4 rounded-lg border border-white/20 bg-black transition-all duration-300 min-h-0",
          // Fixed heights so long results scroll inside the modal.
          minMaxModal && "md:w-full w-full h-dvh p-8",
          !minMaxModal && "md:w-1/2 w-11/12 max-h-[85dvh] p-6 md:p-8",
        )}
      >
        {error && <p className="text-sm text-red-400">{error}</p>}
        {!runStarted && (
          <div className="flex flex-col gap-2">
            <div className="flex flex-col gap-2">
              <h2 className="text-2xl font-bold">Analyze Vault</h2>
              <p className="text-sm text-white/50">
                Let the Goblin analyze your precious ideas and provide you with
                personalized feedback.
              </p>
            </div>
            <div className="md:grid grid-cols-3 gap-4 flex flex-col">
              {PATHWAYS.map((pathway) => (
                <button
                  type="button"
                  onClick={() => setSelectedPathway(pathway)}
                  key={pathway.id}
                  className={clsx(
                    "flex flex-col gap-2 p-4 border border-white/20 rounded-lg hover:border-white/50 transition-colors cursor-pointer",
                    selectedPathway?.id === pathway.id && "border-white/50",
                  )}
                >
                  <div className="flex items-center gap-2">
                    {pathway.icon}
                    <h3 className="text-lg">{pathway.title}</h3>
                  </div>
                  <p className="text-sm text-white/50 text-left">
                    {pathway.description}
                  </p>
                </button>
              ))}
            </div>

            <div className="flex justify-between w-full mt-4 py-4 border-t border-white/20">
              <button className="action-button" onClick={onClose}>
                <XIcon className="w-3 h-3" />
                <span>Cancel</span>
              </button>
              <button
                type="button"
                disabled={!selectedPathway}
                className={clsx(
                  "border flex items-center gap-2 px-4 text-sm border-white/20 py-2 rounded-md transition-colors",
                  selectedPathway
                    ? "opacity-100 hover:cursor-pointer hover:bg-green-500 hover:text-black"
                    : "opacity-50 cursor-not-allowed",
                )}
                onClick={beginPathway}
              >
                {selectedPathway && <Route className="w-3 h-3" />}
                {selectedPathway
                  ? `Start ${selectedPathway.title}`
                  : "Select a pathway"}
              </button>
            </div>
          </div>
        )}
        {pickingBucket && (
          <div className="flex flex-col gap-4">
            <RefinementPicker
              buckets={buckets}
              loading={bucketsLoading}
              recommending={recommending}
              selectedBucketId={selectedBucket?.id ?? null}
              recommendReason={recommendReason}
              onSelect={setSelectedBucket}
              onRecommend={
                scoped || selectedPathway?.id !== "refinement"
                  ? undefined
                  : recommendBucket
              }
              pathway={
                selectedPathway?.id === "gameplan" ? "gameplan" : "refinement"
              }
              focus={focus}
              onFocusChange={setFocus}
              note={note}
              onNoteChange={setNote}
            />
            <div className="flex justify-between w-full py-4 border-t border-white/20">
              <button
                className="action-button"
                onClick={() => {
                  if (scoped) {
                    onClose();
                    return;
                  }
                  setPickingBucket(false);
                  setMinMaxModal(false);
                }}
              >
                <XIcon className="w-3 h-3" />
                {scoped ? "Cancel" : "Back"}
              </button>
              <button
                type="button"
                disabled={!selectedBucket}
                className={clsx(
                  "border flex items-center gap-2 px-4 text-sm border-white/20 py-2 rounded-md transition-colors",
                  selectedBucket
                    ? "opacity-100 hover:cursor-pointer hover:bg-green-500 hover:text-black"
                    : "opacity-50 cursor-not-allowed",
                )}
                onClick={() => startAnalysis()}
              >
                <Route className="w-3 h-3" />
                {selectedPathway?.id === "gameplan" ? "Plan" : "Refine"}{" "}
                {selectedBucket ? selectedBucket.name : "this bucket"}
              </button>
            </div>
          </div>
        )}
        {runStarted && !pickingBucket && (
          <div className="flex flex-col gap-4 flex-1 min-h-0">
            <div className="flex items-center gap-2 flex-wrap shrink-0">
              <h2 className="text-2xl font-bold">{selectedPathway?.title}</h2>
              {analyzing && (
                <span className="flex items-center gap-2 text-sm text-white/60">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  {steps.at(-1)?.message ?? "Waking the goblin..."}
                </span>
              )}
              {result != null && (
                <>
                  <ActionButton
                    disabled={!reasoning || analyzing}
                    action={() => reasoning && setShowReasoning(!showReasoning)}
                  >
                    <Brain className="w-3 h-3" /> Show Reasoning
                  </ActionButton>
                  <ActionButton
                    action={() =>
                      !saved && (reasoning || gameplan) && saveAnalysis()
                    }
                    disabled={saving || analyzing || saved}
                  >
                    <SaveIcon className="w-3 h-3" />
                    {saved
                      ? "Saved"
                      : saving
                        ? "Saving..."
                        : gameplan
                          ? "Save to bucket"
                          : "Save Analysis"}
                  </ActionButton>
                  {refinement && (
                    <ActionButton
                      action={applyRefinement}
                      disabled={applying || applied}
                    >
                      <PencilIcon className="w-3 h-3" />
                      {applied ? "Bucket updated" : "Update bucket"}
                    </ActionButton>
                  )}
                </>
              )}
              <ActionButton action={() => setMinMaxModal(!minMaxModal)}>
                {minMaxModal ? (
                  <>
                    <MinimizeIcon className="w-3 h-3" /> Minimize
                  </>
                ) : (
                  <>
                    <MaximizeIcon className="w-3 h-3" /> Maximize
                  </>
                )}
              </ActionButton>
              <ActionButton action={onClose}>
                <XIcon className="w-3 h-3" /> Close
              </ActionButton>
            </div>
            <div className="flex flex-col gap-4 flex-1 min-h-0 overflow-y-auto pr-1 pb-2">
              <RefinementRounds
                rounds={rounds}
                disabled={analyzing}
                onRestore={restoreDraft}
              />
              {(analyzing || (error && steps.length > 0)) && (
                <div className="rounded-lg border border-white/10 bg-white/5 px-4 py-3">
                  <AnalysisSteps
                    steps={steps}
                    running={analyzing}
                    failed={error != null}
                  />
                  {analyzing && steps.length === 0 && (
                    <p className="flex items-center gap-2 text-sm text-white/60">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      Waking the goblin...
                    </p>
                  )}
                  {analyzing && result == null && (
                    <p className="text-xs text-white/40 mt-3">
                      Results drop in here as the goblin digs them up.
                    </p>
                  )}
                </div>
              )}
              {cached && (
                <p className="text-xs text-white/40">
                  Nothing changed since your last run, so the goblin handed back
                  the same result.
                </p>
              )}
              {showReasoning && reasoning && (
                <p className="text-sm text-white/50">{reasoning}</p>
              )}
              {gameplan ? (
                <GameplanView
                  result={gameplan}
                  onLink={analyzing ? undefined : linkGameplanStep}
                />
              ) : (
                result != null &&
                selectedPathway && (
                  <AnalysisResultConditional
                    result={result}
                    type={selectedPathway.id}
                  />
                )
              )}
              {draft && !analyzing && (
                <RefinementReply
                  value={reply}
                  roundCount={rounds.length}
                  disabled={analyzing}
                  onChange={setReply}
                  onSubmit={refineAgain}
                  placeholder={
                    gameplan
                      ? "e.g. I only have weekends, and skip the marketing phase"
                      : undefined
                  }
                />
              )}
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

export default function AnalyzeVault({
  variant = "button",
  onTrigger,
}: {
  variant?: "button" | "menu";
  onTrigger?: () => void;
}) {
  const [displayModal, setDisplayModal] = useState(false);

  function openModal() {
    onTrigger?.();
    setDisplayModal(true);
  }

  return (
    <>
      {variant === "button" && (
        <ActionButton action={openModal}>
          <SparklesIcon className="w-3 h-3" />
          <span>Analyze Vault</span>
        </ActionButton>
      )}
      {variant === "menu" && (
        <button
          type="button"
          onClick={openModal}
          className="flex items-center gap-2 text-sm w-full rounded-md border border-white/15 bg-black px-4 py-3 text-white/80"
        >
          <SparklesIcon className="w-3 h-3" />
          Analyze Vault
        </button>
      )}

      {displayModal && (
        <AnalyzeVaultModal onClose={() => setDisplayModal(false)} />
      )}
    </>
  );
}
