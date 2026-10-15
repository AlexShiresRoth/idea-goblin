"use client";
import clsx from "clsx";
import {
  Ghost,
  Loader2,
  Route,
  SparklesIcon,
  Waypoints,
  XIcon,
} from "lucide-react";
import { useState } from "react";
import z from "zod";
import ActionButton from "./action-button";

type Pathway = {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
};

const AnalysisResultSchema = z.object({
  choices: z.array(
    z.object({
      main_idea: z.string(),
      bucket_id: z.number(),
      score: z.number(),
      justifications: z.string(),
    }),
  ),
  reasoning: z.string(),
});

// TODO this is incorrect, we need to fix this
const ExecutionResultSchema = z.object({
  choices: z.array(
    z.object({
      main_idea: z.string(),
      bucket_id: z.number(),
      score: z.number(),
      justification: z.string(),
    }),
  ),
  reasoning: z.string(),
});

// TODO this is incorrect, we need to fix this
const RefinementResultSchema = z.object({
  suggestions: z.array(
    z.object({
      main_idea: z.string(),
      bucket_id: z.number(),
      score: z.number(),
      justification: z.string(),
    }),
  ),
  reasoning: z.string(),
});

type AnalysisResult = z.infer<typeof AnalysisResultSchema>;
type ExecutionResult = z.infer<typeof ExecutionResultSchema>;
type RefinementResult = z.infer<typeof RefinementResultSchema>;

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

function AnalysisResult({ result }: { result: AnalysisResult }) {
  const sortedChoices = result.choices.sort((a, b) => b.score - a.score);
  return (
    <div className="grid grid-cols-4 p-2 border border-white/20 rounded-md w-fit gap-4 overflow-auto max-h-60">
      {sortedChoices.map((choice) => {
        return (
          <div
            key={choice.bucket_id}
            className="p-2 border border-white/20 rounded-md flex flex-col gap-2 max-w-sm"
          >
            <span className="text-green-500">Score: {choice.score}</span>
            <h2 className="text-lg font-bold">{choice.main_idea}</h2>
            <p className="text-sm text-white/60">{choice.justifications}</p>
          </div>
        );
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

function AnalyzeVaultModal({ onClose }: { onClose: () => void }) {
  const [selectedPathway, setSelectedPathway] = useState<Pathway | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<unknown>(null);
  const [error, setError] = useState<string | null>(null);

  async function startAnalysis() {
    if (!selectedPathway) return;
    setAnalyzing(true);
    setResult(null);
    setError(null);
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

  console.log("RESULT", result);
  return (
    <div className="fixed inset-0 bg-black/50 flex justify-center items-center z-999">
      <div className="flex flex-col gap-4 p-8 rounded-lg border border-white/20 bg-black md:w-1/2 w-11/12">
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
            {selectedPathway && !analyzing && `Start ${selectedPathway.title}`}
            {!selectedPathway && !analyzing && "Select a pathway"}
            {analyzing && (
              <>
                <Loader2 className="w-3 h-3 animate-spin" /> Analyzing...
              </>
            )}
          </button>
        </div>
        {error && <p className="text-sm text-red-400">{error}</p>}
        {result != null && (
          <AnalysisResultConditional
            result={result as AnalysisResult}
            selectedPathway={selectedPathway?.id ?? ""}
          />
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
