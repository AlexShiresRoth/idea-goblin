"use client";
import { PATHWAYSJSON } from "@/lib/constants";
import type { IdeaView } from "@/lib/db/schema";
import type {
  AnalysisPayload,
  Pathway,
  PathwayId,
  Reasoning,
} from "@/lib/types";
import { isIdeaRefinement } from "@/lib/types";
import clsx from "clsx";
import {
  Brain,
  Ghost,
  GitBranch,
  Loader2,
  MaximizeIcon,
  MinimizeIcon,
  PencilIcon,
  Route,
  SaveIcon,
  SparklesIcon,
  Wrench,
  XIcon,
} from "lucide-react";
import { useContext, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { ToastContext } from "../context/toast.provider";
import ActionButton from "./action-button";
import { AnalysisResultConditional } from "./analysis-result-condition";
import { RefinementPicker } from "./refinement-picker";

const ExecutionPathway = PATHWAYSJSON.execution;
const RefinementPathway = PATHWAYSJSON.refinement;

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
];

function AnalyzeVaultModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const { setToasts } = useContext(ToastContext);
  const [selectedPathway, setSelectedPathway] = useState<Pathway | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<AnalysisPayload | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [applying, setApplying] = useState(false);
  const [applied, setApplied] = useState(false);
  const [addingSub, setAddingSub] = useState(false);
  const [subAdded, setSubAdded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showReasoning, setShowReasoning] = useState(false);
  const [minMaxModal, setMinMaxModal] = useState(false);
  const [pickingIdea, setPickingIdea] = useState(false);
  const [ideas, setIdeas] = useState<IdeaView[]>([]);
  const [ideasLoading, setIdeasLoading] = useState(false);
  const [selectedIdea, setSelectedIdea] = useState<IdeaView | null>(null);
  const [recommending, setRecommending] = useState(false);
  const [recommendReason, setRecommendReason] = useState<string>();
  const reasoning = useMemo(
    () => getReasoningText(result, selectedPathway?.id),
    [result, selectedPathway?.id],
  );
  const refinement =
    result && selectedPathway?.id === "refinement" && isIdeaRefinement(result)
      ? result
      : null;

  async function loadIdeas() {
    setIdeasLoading(true);
    try {
      const response = await fetch("/api/ideas/list");
      if (!response.ok) throw new Error("Failed to load ideas");
      setIdeas((await response.json()) as IdeaView[]);
    } catch (err) {
      console.error(err);
      setError("Failed to load ideas");
    } finally {
      setIdeasLoading(false);
    }
  }

  async function beginPathway() {
    if (!selectedPathway) return;
    if (selectedPathway.id === "refinement") {
      setPickingIdea(true);
      setMinMaxModal(true);
      setSelectedIdea(null);
      setRecommendReason(undefined);
      await loadIdeas();
      return;
    }
    await startAnalysis();
  }

  async function recommendIdea() {
    setRecommending(true);
    setError(null);
    try {
      const response = await fetch("/api/vault/recommend", { method: "POST" });
      if (!response.ok) throw new Error("Failed to recommend an idea");
      const data = (await response.json()) as {
        ideaId: number;
        title: string;
        description: string;
        reason: string;
      };
      const idea =
        ideas.find((item) => item.id === data.ideaId) ??
        ({
          id: data.ideaId,
          title: data.title,
          description: data.description,
        } as IdeaView);
      setSelectedIdea(idea);
      setRecommendReason(data.reason);
    } catch (err) {
      console.error(err);
      setError("Failed to recommend an idea");
    } finally {
      setRecommending(false);
    }
  }

  async function startAnalysis(idea?: IdeaView) {
    if (!selectedPathway) return;
    const ideaToRefine = idea ?? selectedIdea;
    if (selectedPathway.id === "refinement" && !ideaToRefine) return;

    setPickingIdea(false);
    setAnalyzing(true);
    setResult(null);
    setSaved(false);
    setApplied(false);
    setSubAdded(false);
    setError(null);
    setMinMaxModal(true);
    try {
      const response = await fetch("/api/vault/analyze", {
        method: "POST",
        body: JSON.stringify({
          pathway: selectedPathway.id,
          ideaId: ideaToRefine?.id,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to start analysis");
      }

      if (!response.body) {
        throw new Error("No body in response");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line) continue;
          const event = JSON.parse(line) as {
            type: "partial" | "done" | "error";
            data?: unknown;
            message?: string;
          };

          if (event.type === "partial" || event.type === "done") {
            setResult(event.data as AnalysisPayload);
          }
          if (event.type === "error") {
            setError(event.message ?? "Analysis failed");
          }
        }
      }
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
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to save analysis");
      }

      setSaved(true);
      setToasts([
        {
          id: `saved-${selectedPathway.id}-${Date.now()}`,
          message: `${selectedPathway.title} saved`,
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

  async function applyRefinement(kind: "main" | "sub") {
    if (!refinement) return;
    const payload = {
      title: refinement.refined_title,
      description: refinement.refined_idea,
    };

    if (kind === "main") {
      if (applied || applying) return;
      setApplying(true);
      try {
        const response = await fetch("/api/ideas/update", {
          method: "POST",
          body: JSON.stringify({
            ideaId: refinement.idea_id,
            ...payload,
          }),
        });
        if (!response.ok) throw new Error("Failed to update idea");
        setApplied(true);
        setToasts([
          {
            id: `applied-${refinement.idea_id}`,
            message: "Main idea updated. Previous version saved.",
            type: "success",
          },
        ]);
        router.refresh();
      } catch (err) {
        console.error(err);
        setToasts([
          {
            id: `apply-error-${refinement.idea_id}`,
            message: "Failed to update the idea",
            type: "error",
          },
        ]);
      } finally {
        setApplying(false);
      }
      return;
    }

    if (subAdded || addingSub) return;
    setAddingSub(true);
    try {
      const response = await fetch("/api/ideas/sub", {
        method: "POST",
        body: JSON.stringify({
          parentId: refinement.idea_id,
          ...payload,
        }),
      });
      if (!response.ok) throw new Error("Failed to add sub-idea");
      setSubAdded(true);
      setToasts([
        {
          id: `sub-${refinement.idea_id}`,
          message: "Sub-idea added. Parent version saved.",
          type: "success",
        },
      ]);
      router.refresh();
    } catch (err) {
      console.error(err);
      setToasts([
        {
          id: `sub-error-${refinement.idea_id}`,
          message: "Failed to add a sub-idea",
          type: "error",
        },
      ]);
    } finally {
      setAddingSub(false);
    }
  }

  const runStarted = analyzing || result != null || pickingIdea;

  return createPortal(
    <div className="fixed inset-0 bg-black/50 flex justify-center items-center z-999">
      <div
        className={clsx(
          "flex flex-col gap-4 p-8 rounded-lg border border-white/20 bg-black transition-all duration-300",
          minMaxModal && "md:w-full w-full min-h-screen",
          !minMaxModal && "md:w-1/2 w-11/12",
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
            <div className="md:grid grid-cols-2 gap-4 flex flex-col">
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
        {pickingIdea && (
          <div className="flex flex-col gap-4">
            <RefinementPicker
              ideas={ideas}
              loading={ideasLoading}
              recommending={recommending}
              selectedIdeaId={selectedIdea?.id ?? null}
              recommendReason={recommendReason}
              onSelect={setSelectedIdea}
              onRecommend={recommendIdea}
            />
            <div className="flex justify-between w-full py-4 border-t border-white/20">
              <button
                className="action-button"
                onClick={() => {
                  setPickingIdea(false);
                  setMinMaxModal(false);
                }}
              >
                <XIcon className="w-3 h-3" />
                Back
              </button>
              <button
                type="button"
                disabled={!selectedIdea}
                className={clsx(
                  "border flex items-center gap-2 px-4 text-sm border-white/20 py-2 rounded-md transition-colors",
                  selectedIdea
                    ? "opacity-100 hover:cursor-pointer hover:bg-green-500 hover:text-black"
                    : "opacity-50 cursor-not-allowed",
                )}
                onClick={() => startAnalysis()}
              >
                <Route className="w-3 h-3" />
                Refine {selectedIdea ? selectedIdea.title : "this idea"}
              </button>
            </div>
          </div>
        )}
        {runStarted && !pickingIdea && (
          <div className="flex flex-col gap-4 overflow-y-auto max-h-screen">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-2xl font-bold">{selectedPathway?.title}</h2>
              {analyzing && (
                <span
                  aria-live="polite"
                  className="flex items-center gap-2 text-sm text-white/60"
                >
                  <Loader2 className="w-3 h-3 animate-spin" />
                  {result
                    ? "Streaming results..."
                    : "Reading your vault..."}
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
                    action={() => !saved && reasoning && saveAnalysis()}
                    disabled={saving || analyzing || saved}
                  >
                    <SaveIcon className="w-3 h-3" />
                    {saved ? "Saved" : saving ? "Saving..." : "Save Analysis"}
                  </ActionButton>
                  {refinement && (
                    <>
                      <ActionButton
                        action={() => applyRefinement("main")}
                        disabled={applying || applied}
                      >
                        <PencilIcon className="w-3 h-3" />
                        {applied ? "Main idea updated" : "Update main idea"}
                      </ActionButton>
                      <ActionButton
                        action={() => applyRefinement("sub")}
                        disabled={addingSub || subAdded}
                      >
                        <GitBranch className="w-3 h-3" />
                        {subAdded ? "Sub-idea added" : "Add as sub-idea"}
                      </ActionButton>
                    </>
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
            {analyzing && result == null && (
              <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
                <Loader2 className="w-6 h-6 animate-spin text-white/70" />
                <p className="text-sm text-white/60">
                  Goblin is working through your vault.
                </p>
                <p className="text-xs text-white/40">
                  Results will appear here as they land.
                </p>
              </div>
            )}
            {showReasoning && reasoning && (
              <p className="text-sm text-white/50">{reasoning}</p>
            )}
            {result != null && selectedPathway && (
              <AnalysisResultConditional
                result={result}
                type={selectedPathway.id}
              />
            )}
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
