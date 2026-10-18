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
      "Goblin will score what is worth your attention, then weigh feasibility and effort to recommend pursue, park, or kill.",
  },
  refinement: {
    id: "refinement",
    title: "Idea Refinement",
    description:
      "Pick a bucket, or let Goblin recommend one, then sharpen it using the ideas inside and keep versions as you go.",
  },
};
