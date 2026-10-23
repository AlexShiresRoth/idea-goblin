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
    title: "Pick a Winner",
    description:
      "Goblin will score what is worth your attention, then weigh feasibility and effort to recommend pursue, park, or kill.",
  },
  refinement: {
    id: "refinement",
    title: "Sharpen a Bucket",
    description:
      "Pick a bucket, or let Goblin recommend one, then sharpen it using the ideas inside and keep versions as you go.",
  },
  gameplan: {
    id: "gameplan",
    title: "Gameplan",
    description:
      "Pick a bucket and Goblin maps out how to finish it: a finish line, a few phases, a first step for today, and what to cut.",
  },
};
