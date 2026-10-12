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
import ActionButton from "./action-button";

type Pathway = {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
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

function AnalyzeVaultModal({ onClose }: { onClose: () => void }) {
  const [selectedPathway, setSelectedPathway] = useState<Pathway | null>(null);
  const [analyzing, setAnalyzing] = useState(false);

  async function startAnalysis() {
    if (!selectedPathway) return;
    setAnalyzing(true);
    try {
      const response = await fetch("/api/vault/analyze", {
        method: "POST",
        body: JSON.stringify({ pathway: selectedPathway.id }),
      });

      if (!response.ok) {
        throw new Error("Failed to start analysis");
      }

      const data = await response.json();
      console.log(data);
    } catch (error) {
      console.error(error);
    } finally {
      setAnalyzing(false);
    }
  }

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
            {selectedPathway && !analyzing
              ? `Start ${selectedPathway.title}`
              : "Select a pathway"}
            {analyzing && (
              <>
                <Loader2 className="w-3 h-3 animate-spin" /> Analyzing...
              </>
            )}
          </button>
        </div>
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
