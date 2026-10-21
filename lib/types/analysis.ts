export type PathwayId = "analysis" | "execution" | "refinement" | "gameplan";

export type Pathway = {
  id: PathwayId;
  title: string;
  description: string;
  icon: React.ReactNode;
};

export type Reasoning = {
  main_idea: string;
  reasons: {
    title: string;
    reasoning: string;
  }[];
};

export type AnalysisResult = {
  choices: {
    main_idea: string;
    bucket_id: number;
    score: number;
    justifications: string;
  }[];
  reasoning: Reasoning;
};

export type ExecutionResult = {
  choices: {
    bucket_id: number;
    title?: string;
    main_idea?: string;
    score?: number;
    justifications?: string;
    feasibility: number;
    estimated_effort: "low" | "medium" | "high";
    recommendation: "pursue" | "park" | "kill";
    // Only present on runs saved before reasoning was dropped from execution.
    reasoning?: Reasoning;
  }[];
  summary: string;
};

export type LegacyRefinementResult = {
  suggestions: {
    bucket_id: number;
    original_idea: string;
    refined_idea: string;
    improvements: string[];
  }[];
  reasoning: Reasoning;
};

// Saved by runs from before refinement moved to buckets.
export type IdeaRefinementResult = {
  idea_id: number;
  original_title: string;
  original_idea: string;
  refined_title: string;
  refined_idea: string;
  improvements: string[];
  reasoning: Reasoning;
};

// The bucket is the main idea; its ideas are context for the refinement.
export type BucketRefinementResult = {
  bucket_id: number;
  original_name: string;
  original_description: string;
  refined_name: string;
  refined_description: string;
  // Missing on runs saved before buckets had categories.
  refined_category?: string;
  improvements: string[];
  reasoning: Reasoning;
};

// A plan to finish one bucket. Steps may build on ideas already in it.
export type GameplanStep = {
  title: string;
  detail: string;
  idea_id: number | null;
  effort: "low" | "medium" | "high";
};

export type GameplanResult = {
  bucket_id: number;
  bucket_name: string;
  // What "complete" means for this bucket.
  finish_line: string;
  where_you_are: string;
  first_step: { title: string; detail: string };
  phases: { title: string; goal: string; steps: GameplanStep[] }[];
  cut: string[];
  risks: string[];
};

// One back-and-forth on a draft: what Goblin produced and the user's reply
// to it, which steers the next draft.
export type Round<Draft> = { draft: Draft; feedback: string };
export type RefinementRound = Round<BucketRefinementResult>;
export type GameplanRound = Round<GameplanResult>;

export type RefinementResult =
  LegacyRefinementResult | IdeaRefinementResult | BucketRefinementResult;

export function isIdeaRefinement(
  result: AnalysisPayload,
): result is IdeaRefinementResult {
  return "refined_idea" in result && "idea_id" in result;
}

export function isGameplan(result: AnalysisPayload): result is GameplanResult {
  return "finish_line" in result && "phases" in result;
}

export function isBucketRefinement(
  result: AnalysisPayload,
): result is BucketRefinementResult {
  return "refined_description" in result && "bucket_id" in result;
}

export type AnalysisPayload =
  AnalysisResult | ExecutionResult | RefinementResult | GameplanResult;
