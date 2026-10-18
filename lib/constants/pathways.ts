import type { PathwayId } from "@/lib/types";

export const PATHWAYSJSON: Record<
  PathwayId,
  { id: PathwayId; title: string; description: string }
> = {
  analysis: {
    id: "analysis",
    title: "Idea Analysis",
    description:
      "Goblin will uncover patterns across your vault and identify the ideas most worth your attention.",
  },
  execution: {
    id: "execution",
    title: "Idea Execution",
    description:
      "Goblin will evaluate effort, complexity, and feasibility to find what you can realistically build, and what to kill.",
  },
  refinement: {
    id: "refinement",
    title: "Idea Refinement",
    description:
      "Goblin will research similar ideas, uncover opportunities, and find ideas in your vault worth evolving.",
  },
};
