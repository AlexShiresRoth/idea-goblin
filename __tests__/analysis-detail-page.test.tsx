import { getAnalysisResult } from "@/lib/api/analysis";
import type { AnalysisResult } from "@/lib/db/schema";
import type {
  BucketRefinementResult,
  ExecutionResult,
  GameplanResult,
} from "@/lib/types";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { userId } from "./helpers";

vi.mock("@/lib/api/analysis", () => ({ getAnalysisResult: vi.fn() }));
vi.mock("@/app/components/delete-analysis-button", () => ({
  DeleteAnalysisButton: ({
    analysisId,
    redirectTo,
  }: {
    analysisId: number;
    redirectTo?: string;
  }) => (
    <button type="button" data-redirect={redirectTo}>
      Delete {analysisId}
    </button>
  ),
}));
vi.mock("@/app/components/saved-gameplan-view", () => ({
  SavedGameplanView: ({
    analysisId,
    result,
  }: {
    analysisId: number;
    result: GameplanResult;
  }) => (
    <div data-testid="saved-gameplan" data-analysis-id={analysisId}>
      {result.finish_line}
    </div>
  ),
}));

import AnalysisPage from "@/app/main/analysis/[id]/page";

function makeAnalysis(
  analysisType: AnalysisResult["analysisType"],
  analysisData: unknown,
): AnalysisResult {
  return {
    id: 42,
    profileId: userId,
    analysisType,
    bucketId: null,
    analysisData: analysisData as never,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  };
}

async function renderPage(id = "42") {
  render(await AnalysisPage({ params: Promise.resolve({ id }) }));
}

const execution: ExecutionResult = {
  summary: "Ship the tutoring app first.",
  choices: [
    {
      bucket_id: 1,
      title: "Tutor app",
      main_idea: "On-demand homework help",
      score: 80,
      feasibility: 70,
      estimated_effort: "medium",
      recommendation: "pursue",
    },
    {
      bucket_id: 2,
      main_idea: "A recipe swap site",
      feasibility: 40,
      estimated_effort: "high",
      recommendation: "park",
      reasoning: {
        main_idea: "Crowded market",
        reasons: [{ title: "Competition", reasoning: "Lots of big players" }],
      },
    },
    {
      bucket_id: 3,
      feasibility: 10,
      estimated_effort: "low",
      recommendation: "kill",
    },
  ],
};

const refinement: BucketRefinementResult = {
  bucket_id: 1,
  original_name: "Tutor app",
  original_description: "Help kids with homework",
  refined_name: "Homework Hero",
  refined_description: "On-demand tutoring for middle schoolers",
  improvements: ["Named the audience"],
  reasoning: {
    main_idea: "Narrowing the audience makes it sellable",
    reasons: [
      { title: "Audience", reasoning: "Parents of middle schoolers pay" },
      { title: "Scope", reasoning: "One subject to start" },
    ],
  },
};

const gameplan: GameplanResult = {
  bucket_id: 1,
  bucket_name: "Tutor app",
  finish_line: "Ten paying families",
  where_you_are: "Just an idea",
  first_step: { title: "Call three parents", detail: "Ask what they pay" },
  phases: [],
  cut: [],
  risks: [],
};

describe("Analysis detail page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows not found when there is no analysis", async () => {
    vi.mocked(getAnalysisResult).mockResolvedValue(null);

    await renderPage("99");

    expect(getAnalysisResult).toHaveBeenCalledWith("99");
    expect(screen.getByText("Analysis not found")).toBeInTheDocument();
  });

  it("shows an execution result's summary and each choice", async () => {
    const user = userEvent.setup();
    vi.mocked(getAnalysisResult).mockResolvedValue(
      makeAnalysis("execution", execution),
    );

    await renderPage();

    expect(
      screen.getByRole("heading", { level: 1, name: "Idea Execution" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Ship the tutoring app first."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete 42" })).toHaveAttribute(
      "data-redirect",
      "/main/analysis",
    );

    // Collapsed sections: title, recommendation and a preview when it differs.
    const tutor = screen.getByRole("button", { name: /Tutor app/ });
    expect(tutor).toHaveTextContent("pursue");
    expect(tutor).toHaveTextContent("On-demand homework help");
    expect(
      screen.getByRole("button", { name: /A recipe swap site/ }),
    ).toHaveTextContent("park");
    expect(screen.getByRole("button", { name: /Idea 3/ })).toHaveTextContent(
      "kill",
    );

    // Execution has no separate reasoning or results sections.
    expect(
      screen.queryByRole("button", { name: /^Reasoning/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /^Results/ }),
    ).not.toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: /A recipe swap site/ }),
    );
    expect(screen.getByText("Competition")).toBeInTheDocument();
    expect(screen.getByText("Lots of big players")).toBeInTheDocument();
  });

  it("hides the summary when an execution result has none", async () => {
    vi.mocked(getAnalysisResult).mockResolvedValue(
      makeAnalysis("execution", { ...execution, summary: "" }),
    );

    await renderPage();

    expect(screen.queryByText("Summary")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Tutor app/ }),
    ).toBeInTheDocument();
  });

  it("shows a refinement's reasoning and results", async () => {
    const user = userEvent.setup();
    vi.mocked(getAnalysisResult).mockResolvedValue(
      makeAnalysis("refinement", refinement),
    );

    await renderPage();

    expect(
      screen.getByRole("heading", { level: 1, name: "Idea Refinement" }),
    ).toBeInTheDocument();

    // Results are open by default.
    expect(
      screen.getByRole("button", { name: "Results · 1" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Homework Hero")).toBeInTheDocument();
    expect(screen.getByText("Named the audience")).toBeInTheDocument();

    // Reasoning is collapsed behind its main idea.
    const reasoning = screen.getByRole("button", { name: /Reasoning · 2/ });
    expect(reasoning).toHaveTextContent(
      "Narrowing the audience makes it sellable",
    );
    expect(screen.queryByText("Audience")).not.toBeInTheDocument();

    await user.click(reasoning);
    expect(screen.getByText("Audience")).toBeInTheDocument();
    expect(
      screen.getByText("Parents of middle schoolers pay"),
    ).toBeInTheDocument();
  });

  it("counts legacy refinement suggestions in the results title", async () => {
    vi.mocked(getAnalysisResult).mockResolvedValue(
      makeAnalysis("refinement", {
        suggestions: [
          {
            bucket_id: 1,
            original_idea: "Old one",
            refined_idea: "New one",
            improvements: ["Sharper"],
          },
          {
            bucket_id: 2,
            original_idea: "Old two",
            refined_idea: "New two",
            improvements: [],
          },
        ],
        reasoning: { main_idea: "Both got sharper", reasons: [] },
      }),
    );

    await renderPage();

    expect(
      screen.getByRole("button", { name: "Results · 2" }),
    ).toBeInTheDocument();
    expect(screen.getByText("New two")).toBeInTheDocument();
  });

  it("shows a gameplan's bucket name and plan", async () => {
    vi.mocked(getAnalysisResult).mockResolvedValue(
      makeAnalysis("gameplan", gameplan),
    );

    await renderPage();

    expect(
      screen.getByRole("heading", { level: 1, name: "Gameplan" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Tutor app")).toBeInTheDocument();
    const plan = screen.getByTestId("saved-gameplan");
    expect(plan).toHaveTextContent("Ten paying families");
    expect(plan).toHaveAttribute("data-analysis-id", "42");

    // A gameplan has no reasoning, and the plan replaces the results section.
    expect(
      screen.queryByRole("button", { name: /^Reasoning/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /^Results/ }),
    ).not.toBeInTheDocument();
  });
});
