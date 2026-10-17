"use client";
import clsx from "clsx";
import {
  Brain,
  Ghost,
  Loader2,
  MaximizeIcon,
  MinimizeIcon,
  Route,
  SaveIcon,
  ScanHeart,
  SparklesIcon,
  Waypoints,
  XIcon,
} from "lucide-react";
import { useMemo, useState } from "react";
import ActionButton from "./action-button";

type Pathway = {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
};

type AnalysisResult = {
  choices: {
    main_idea: string;
    bucket_id: number;
    score: number;
    justifications: string;
  }[];
  reasoning: string;
};

type ExecutionResult = {
  choices: {
    main_idea: string;
    bucket_id: number;
    score: number;
    justification: string;
  }[];
  reasoning: string;
};

type RefinementResult = {
  suggestions: {
    main_idea: string;
    bucket_id: number;
    score: number;
    justification: string;
  }[];
  reasoning: string;
};

const PATHWAYS: Pathway[] = [
  {
    id: "analysis",
    title: "Idea Analysis",
    description:
      "Goblin will uncover patterns across your vault and identify the ideas most worth your attention.",
    icon: <Waypoints className="w-3 h-3" />,
  },
  {
    id: "execution",
    title: "Idea Execution",
    description:
      "Goblin will evaluate effort, complexity, and feasibility to find what you can realistically build, and what to kill.",
    icon: <Ghost className="w-3 h-3" />,
  },
  {
    id: "refinement",
    title: "Idea Refinement",
    description:
      "Goblin will research similar ideas, uncover opportunities, and find ideas in your vault worth evolving.",
    icon: <Ghost className="w-3 h-3" />,
  },
];

function ResultItem({ choice }: { choice: AnalysisResult["choices"][number] }) {
  const score = choice.score;
  return (
    <div
      key={choice.bucket_id}
      className="p-4 border border-white/20 rounded-md flex flex-col items-start gap-2 max-w-sm animate-fade-in flex-1 min-w-xs"
    >
      <div className="flex items-center justify-between w-full gap-1">
        <div
          className={clsx(
            " flex items-center gap-1 border rounded p-1",
            score > 75 &&
              "border-green-500/40 bg-green-500/10 text-green-500/80",
            score > 50 &&
              score < 75 &&
              "border-yellow-500/40 bg-yellow-500/10 text-yellow-500/80",
            score > 25 &&
              score < 50 &&
              "border-orange-500/40 bg-orange-500/10 text-orange-500/80",
            score >= 0 &&
              score < 25 &&
              "border-red-500/40 bg-red-500/10 text-red-500/80",
          )}
        >
          <span className="text-xl"> {choice.score}</span>
        </div>
        <span>
          <ScanHeart className="w-3 h-3" />
        </span>
      </div>
      <h2 className="text-lg font-bold">{choice.main_idea}</h2>
      <p className="text-sm text-white/60">{choice.justifications}</p>
    </div>
  );
}

function AnalysisResult({ result }: { result: AnalysisResult }) {
  const sortedChoices = result.choices.sort((a, b) => b.score - a.score);

  return (
    <div className="flex items-stretch flex-wrap p-4 border border-white/20 rounded-md gap-4">
      {sortedChoices.map((choice) => {
        return <ResultItem key={choice.bucket_id} choice={choice} />;
      })}
    </div>
  );
}

function ExecutionResult({ result }: { result: ExecutionResult }) {
  return (
    <div>
      {result.choices.map((choice) => {
        return <div key={choice.bucket_id}> {choice.main_idea} </div>;
      })}
    </div>
  );
}

function RefinementResult({ result }: { result: RefinementResult }) {
  return (
    <div>
      {result.suggestions.map((suggestion) => {
        return <div key={suggestion.bucket_id}> {suggestion.main_idea} </div>;
      })}
    </div>
  );
}

function AnalysisResultConditional<T>({
  result,
  selectedPathway,
}: {
  result: T;
  selectedPathway: Pathway["id"];
}) {
  switch (selectedPathway) {
    case "analysis":
      return <AnalysisResult result={result as AnalysisResult} />;
    case "execution":
      return <ExecutionResult result={result as ExecutionResult} />;
    case "refinement":
      return <RefinementResult result={result as RefinementResult} />;
  }
}

// TODO I think we should break apart the reasoning into 3 pieces
function AnalyzeVaultModal({ onClose }: { onClose: () => void }) {
  const [selectedPathway, setSelectedPathway] = useState<Pathway | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<unknown>(null);
  const [error, setError] = useState<string | null>(null);
  const [showReasoning, setShowReasoning] = useState(false);
  const [minMaxModal, setMinMaxModal] = useState(false);
  const reasoning = useMemo(
    () => (result as AnalysisResult)?.reasoning,
    [result],
  );

  async function startAnalysis() {
    if (!selectedPathway) return;
    setAnalyzing(true);
    setResult(null);
    setError(null);
    setMinMaxModal(false);
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
            setResult(event.data);
            console.log(event.data);
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

  return (
    <div className="fixed inset-0 bg-black/50 flex justify-center items-center z-999">
      <div
        className={clsx(
          "flex flex-col gap-4 p-8 rounded-lg border border-white/20 bg-black transition-all duration-300",
          !minMaxModal && "md:w-full w-full min-h-screen",
          minMaxModal && "md:w-1/2 w-11/12",
        )}
      >
        <div
          className={clsx(
            result != null &&
              "hidden opacity-0 max-h-0 transition-all duration-300",
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
                action={() => reasoning && setShowReasoning(!showReasoning)}
              >
                <Brain className="w-3 h-3" /> Show Reasoning
              </ActionButton>
              <ActionButton
                action={() => reasoning && setShowReasoning(!showReasoning)}
              >
                <SaveIcon className="w-3 h-3" />
                Save Analysis
              </ActionButton>
              <ActionButton action={() => setMinMaxModal(!minMaxModal)}>
                {minMaxModal ? (
                  <>
                    <MaximizeIcon className="w-3 h-3" /> Maximize
                  </>
                ) : (
                  <>
                    <MinimizeIcon className="w-3 h-3" /> Minimize
                  </>
                )}
              </ActionButton>
            </div>
            {showReasoning && (
              <p className="text-sm text-white/50">{reasoning}</p>
            )}
            <AnalysisResultConditional
              result={result as AnalysisResult}
              selectedPathway={selectedPathway?.id ?? ""}
            />
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
