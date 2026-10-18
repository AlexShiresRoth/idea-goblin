"use client";
import { PATHWAYSJSON } from "@/lib/constants";
import type { AnalysisPayload, Pathway, Reasoning } from "@/lib/types";
import clsx from "clsx";
import {
  Brain,
  Ghost,
  Loader2,
  MaximizeIcon,
  MinimizeIcon,
  Route,
  SaveIcon,
  SparklesIcon,
  Waypoints,
  Wrench,
  XIcon,
} from "lucide-react";
import { useContext, useMemo, useState } from "react";
import { ToastContext } from "../context/toast.provider";
import ActionButton from "./action-button";
import { AnalysisResultConditional } from "./analysis-result-condition";

const AnalysisPathway = PATHWAYSJSON.analysis;
const ExecutionPathway = PATHWAYSJSON.execution;
const RefinementPathway = PATHWAYSJSON.refinement;

function getReasoningText(result: AnalysisPayload | null): string | undefined {
  if (!result) return undefined;
  if ("summary" in result) return result.summary;
  return [
    result.reasoning.main_idea,
    ...result.reasoning.reasons.map(
      (reason: Reasoning["reasons"][number]) =>
        `${reason.title}: ${reason.reasoning}`,
    ),
  ].join("\n");
}

const PATHWAYS: Pathway[] = [
  {
    id: AnalysisPathway.id,
    title: AnalysisPathway.title,
    description: AnalysisPathway.description,
    icon: <Waypoints className="w-3 h-3" />,
  },
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
  const { setToasts } = useContext(ToastContext);
  const [selectedPathway, setSelectedPathway] = useState<Pathway | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<AnalysisPayload | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showReasoning, setShowReasoning] = useState(false);
  const [minMaxModal, setMinMaxModal] = useState(false);
  const reasoning = useMemo(() => getReasoningText(result), [result]);

  async function startAnalysis() {
    if (!selectedPathway) return;
    setAnalyzing(true);
    setResult(null);
    setError(null);
    setMinMaxModal(true);
    try {
      const response = await fetch("/api/vault/analyze", {
        method: "POST",
        body: JSON.stringify({ pathway: selectedPathway.id }),
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
    if (!result || !selectedPathway) return;
    setSaving(true);
    try {
      await fetch("/api/vault/save", {
        method: "POST",
        body: JSON.stringify({
          data: result,
          analysisType: selectedPathway?.id,
        }),
      });
    } catch (err) {
      console.error(err);
      setError("Failed to save analysis");
      setToasts([
        {
          message: "Failed to save analysis",
          type: "error",
          id: selectedPathway?.id,
        },
      ]);
    } finally {
      setSaving(false);
      setToasts([
        {
          message: "Your analysis has been saved",
          type: "success",
          id: selectedPathway?.id,
        },
      ]);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex justify-center items-center z-999">
      <div
        className={clsx(
          "flex flex-col gap-4 p-8 rounded-lg border border-white/20 bg-black transition-all duration-300",
          minMaxModal && "md:w-full w-full min-h-screen",
          !minMaxModal && "md:w-1/2 w-11/12",
        )}
      >
        <div
          className={clsx(
            result != null &&
              "hidden opacity-0 max-h-0 transition-all duration-300",
            "flex flex-col gap-2",
          )}
        >
          <div className={clsx("flex flex-col gap-2")}>
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
              disabled={!selectedPathway || analyzing}
              className={clsx(
                "border flex items-center gap-2 px-4 text-sm border-white/20 py-2 rounded-md transition-colors",
                selectedPathway
                  ? "opacity-100 hover:cursor-pointer hover:bg-green-500 hover:text-black"
                  : "opacity-50 cursor-not-allowed",
              )}
              onClick={startAnalysis}
            >
              {selectedPathway && !analyzing && <Route className="w-3 h-3" />}
              {selectedPathway &&
                !analyzing &&
                `Start ${selectedPathway.title}`}
              {!selectedPathway && !analyzing && "Select a pathway"}
              {analyzing && (
                <>
                  <Loader2 className="w-3 h-3 animate-spin" /> Analyzing...
                </>
              )}
            </button>
          </div>
        </div>
        {error && <p className="text-sm text-red-400">{error}</p>}
        {result != null && (
          <div className="flex flex-col gap-4 overflow-y-auto max-h-screen p-8">
            <div className="flex items-center gap-2">
              <h2 className="text-2xl font-bold">{selectedPathway?.title}</h2>
              <ActionButton
                disabled={!reasoning}
                action={() => reasoning && setShowReasoning(!showReasoning)}
              >
                <Brain className="w-3 h-3" /> Show Reasoning
              </ActionButton>
              <ActionButton
                action={() => reasoning && saveAnalysis()}
                disabled={saving}
              >
                <SaveIcon className="w-3 h-3" />
                {saving ? "Saving..." : "Save Analysis"}
              </ActionButton>
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
            </div>
            {showReasoning && (
              <p className="text-sm text-white/50">{reasoning}</p>
            )}
            {selectedPathway && (
              <AnalysisResultConditional
                result={result}
                type={selectedPathway.id}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function AnalyzeVault() {
  const [displayModal, setDisplayModal] = useState(false);
  return (
    <>
      <ActionButton action={() => setDisplayModal(true)}>
        <SparklesIcon className="w-3 h-3" />
        <span>Analyze Vault</span>
      </ActionButton>

      {displayModal && (
        <AnalyzeVaultModal onClose={() => setDisplayModal(false)} />
      )}
    </>
  );
}
