export type PathwayId = "analysis" | "execution" | "refinement";

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
    feasibility: number;
    estimated_effort: "low" | "medium" | "high";
    recommendation: "pursue" | "park" | "kill";
    reasoning: Reasoning;
  }[];
  summary: string;
};

export type RefinementResult = {
  suggestions: {
    bucket_id: number;
    original_idea: string;
    refined_idea: string;
    improvements: string[];
  }[];
  reasoning: Reasoning;
};

export type AnalysisPayload =
  | AnalysisResult
  | ExecutionResult
  | RefinementResult;
