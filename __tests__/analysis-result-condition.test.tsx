import {
  AnalysisItem,
  AnalysisResultConditional,
  ExecutionChoiceCard,
  RecommendationBadge,
  RefinementCard,
} from "@/app/components/analysis-result-condition";
import { ToastContext } from "@/app/context/toast.provider";
import type {
  AnalysisPayload,
  BucketRefinementResult,
  ExecutionResult,
  GameplanResult,
  IdeaRefinementResult,
  LegacyRefinementResult,
  PathwayId,
  Reasoning,
} from "@/lib/types";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

type Choice = ExecutionResult["choices"][number];

const reasoning: Reasoning = { main_idea: "Overall", reasons: [] };

function choice(overrides: Partial<Choice> = {}): Choice {
  return {
    bucket_id: 1,
    title: "Waitlist page",
    main_idea: "Collect emails before building",
    score: 80,
    justifications: "Cheap to test demand.",
    feasibility: 70,
    estimated_effort: "medium",
    recommendation: "pursue",
    ...overrides,
  };
}

function renderResult(result: AnalysisPayload, type: PathwayId) {
  return render(
    <ToastContext.Provider value={{ toasts: [], setToasts: vi.fn() }}>
      <AnalysisResultConditional result={result} type={type} />
    </ToastContext.Provider>,
  );
}

describe("RecommendationBadge", () => {
  it.each([
    ["pursue", "text-green-500/80"],
    ["park", "text-yellow-500/80"],
    ["kill", "text-red-500/80"],
  ] as const)("shows %s in its tone", (recommendation, tone) => {
    render(<RecommendationBadge recommendation={recommendation} />);

    expect(screen.getByText(recommendation)).toHaveClass(tone);
  });
});

describe("ExecutionChoiceCard", () => {
  it("shows the title, main idea, recommendation and metrics", () => {
    render(<ExecutionChoiceCard choice={choice()} />);

    expect(
      screen.getByRole("heading", { name: "Waitlist page" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Collect emails before building"),
    ).toBeInTheDocument();
    expect(screen.getByText("pursue")).toBeInTheDocument();
    expect(screen.getByText("Value")).toBeInTheDocument();
    expect(screen.getByText("80")).toBeInTheDocument();
    expect(screen.getByText("Feasibility")).toBeInTheDocument();
    expect(screen.getByText("70")).toBeInTheDocument();
    expect(screen.getByText("medium")).toBeInTheDocument();
  });

  it("uses the main idea as the heading when there is no title", () => {
    render(<ExecutionChoiceCard choice={choice({ title: undefined })} />);

    expect(
      screen.getByRole("heading", { name: "Collect emails before building" }),
    ).toBeInTheDocument();
    expect(screen.getAllByText("Collect emails before building")).toHaveLength(
      1,
    );
  });

  it("falls back to the legacy reasoning main idea", () => {
    render(
      <ExecutionChoiceCard
        choice={choice({
          title: undefined,
          main_idea: undefined,
          reasoning: { main_idea: "From old reasoning", reasons: [] },
        })}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "From old reasoning" }),
    ).toBeInTheDocument();
  });

  it("shows only the title when there is no main idea", () => {
    render(<ExecutionChoiceCard choice={choice({ main_idea: undefined })} />);

    expect(
      screen.getByRole("heading", { name: "Waitlist page" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Collect emails before building"),
    ).not.toBeInTheDocument();
  });

  it("shows a dash when there is no score", () => {
    render(<ExecutionChoiceCard choice={choice({ score: undefined })} />);

    expect(screen.getByText("–")).toBeInTheDocument();
  });

  it.each([
    [100, "text-green-500/90"],
    [75, "text-green-500/90"],
    [74, "text-yellow-500/90"],
    [51, "text-yellow-500/90"],
    [50, "text-orange-500/90"],
    [26, "text-orange-500/90"],
    [25, "text-red-500/90"],
    [0, "text-red-500/90"],
  ])("colours a score of %i with %s", (score, tone) => {
    render(<ExecutionChoiceCard choice={choice({ score, feasibility: 33 })} />);

    expect(screen.getByText(String(score))).toHaveClass(tone);
  });

  it.each([
    ["low", 1],
    ["medium", 2],
    ["high", 3],
  ] as const)("fills %s effort with %i dots", (effort, filled) => {
    render(
      <ExecutionChoiceCard choice={choice({ estimated_effort: effort })} />,
    );

    const dots = screen.getByLabelText(`${effort} effort`).children;
    expect(dots).toHaveLength(3);
    expect(
      [...dots].filter((dot) => dot.classList.contains("bg-white/60")),
    ).toHaveLength(filled);
  });

  it.each([
    [150, "100%"],
    [-10, "0%"],
    [42, "42%"],
  ])("draws a feasibility of %i as a %s bar", (feasibility, width) => {
    render(<ExecutionChoiceCard choice={choice({ feasibility })} />);

    const bar = screen.getByText(String(feasibility)).nextElementSibling
      ?.firstElementChild as HTMLElement;
    expect(bar.style.width).toBe(width);
  });

  it("toggles the justifications", async () => {
    const user = userEvent.setup();
    render(<ExecutionChoiceCard choice={choice()} />);
    const toggle = screen.getByRole("button", { name: /justifications/i });

    expect(screen.queryByText("Cheap to test demand.")).not.toBeInTheDocument();
    await user.click(toggle);
    expect(screen.getByText("Cheap to test demand.")).toBeInTheDocument();
    await user.click(toggle);
    expect(screen.queryByText("Cheap to test demand.")).not.toBeInTheDocument();
  });

  it("has no justifications toggle without justifications", () => {
    render(
      <ExecutionChoiceCard choice={choice({ justifications: undefined })} />,
    );

    expect(
      screen.queryByRole("button", { name: /justifications/i }),
    ).not.toBeInTheDocument();
  });
});

describe("AnalysisItem", () => {
  const item = {
    bucket_id: 1,
    main_idea: "Start a newsletter",
    score: 60,
    justifications: "You already write weekly.",
  };

  it("shows the score, idea and toggleable justifications", async () => {
    const user = userEvent.setup();
    render(<AnalysisItem choice={item} />);

    expect(screen.getByText("60")).toBeInTheDocument();
    expect(screen.getByText("Start a newsletter")).toBeInTheDocument();
    expect(
      screen.queryByText("You already write weekly."),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /justifications/i }));

    expect(screen.getByText("You already write weekly.")).toBeInTheDocument();
  });

  it.each([
    [75, "text-green-500/80"],
    [74, "text-yellow-500/80"],
    [51, "text-yellow-500/80"],
    [50, "text-orange-500/80"],
    [26, "text-orange-500/80"],
    [25, "text-red-500/80"],
  ])("colours a score of %i with %s", (score, tone) => {
    render(<AnalysisItem choice={{ ...item, score }} />);

    expect(screen.getByText(String(score)).parentElement).toHaveClass(tone);
  });
});

describe("AnalysisResultConditional", () => {
  describe("execution", () => {
    it("orders choices pursue, park, kill, then by score", () => {
      const result: ExecutionResult = {
        summary: "Summary",
        choices: [
          choice({ bucket_id: 1, title: "Killed", recommendation: "kill" }),
          choice({
            bucket_id: 2,
            title: "Parked",
            recommendation: "park",
            score: 90,
          }),
          choice({
            bucket_id: 3,
            title: "Pursue low",
            recommendation: "pursue",
            score: 40,
          }),
          choice({
            bucket_id: 4,
            title: "Pursue unscored",
            recommendation: "pursue",
            score: undefined,
          }),
          choice({
            bucket_id: 5,
            title: "Pursue high",
            recommendation: "pursue",
            score: 85,
          }),
        ],
      };

      renderResult(result, "execution");

      expect(
        screen.getAllByRole("heading").map((heading) => heading.textContent),
      ).toEqual([
        "Pursue high",
        "Pursue low",
        "Pursue unscored",
        "Parked",
        "Killed",
      ]);
    });
  });

  describe("refinement", () => {
    const bucketRefinement: BucketRefinementResult = {
      bucket_id: 3,
      original_name: "Side project",
      original_description: "Some app thing",
      refined_name: "Habit tracker for runners",
      refined_description: "Track weekly mileage streaks.",
      refined_category: "software",
      improvements: ["Narrowed the audience", "Named the core loop"],
      reasoning,
    };

    it("shows a bucket refinement with its category icon", () => {
      renderResult(bucketRefinement, "refinement");

      expect(screen.getByText("Original")).toBeInTheDocument();
      expect(screen.getByText("Side project")).toBeInTheDocument();
      expect(screen.getByText("Some app thing")).toBeInTheDocument();
      expect(
        screen.getByRole("heading", { name: "Habit tracker for runners" }),
      ).toBeInTheDocument();
      expect(
        screen.getByText("Track weekly mileage streaks."),
      ).toBeInTheDocument();
      expect(screen.getByTestId("bucket-icon")).toHaveAttribute(
        "data-category",
        "software",
      );
      expect(
        screen.getAllByRole("listitem").map((item) => item.textContent),
      ).toEqual(["Narrowed the audience", "Named the core loop"]);
    });

    it("shows a bucket refinement saved before categories without an icon", () => {
      const withoutCategory = {
        ...bucketRefinement,
        refined_category: undefined,
      };
      renderResult(withoutCategory, "refinement");

      expect(
        screen.getByRole("heading", { name: "Habit tracker for runners" }),
      ).toBeInTheDocument();
      expect(screen.queryByTestId("bucket-icon")).not.toBeInTheDocument();
    });

    it("omits the improvements list when there are none", () => {
      renderResult({ ...bucketRefinement, improvements: [] }, "refinement");

      expect(screen.queryByRole("list")).not.toBeInTheDocument();
    });

    it("shows an older idea refinement", () => {
      const result: IdeaRefinementResult = {
        idea_id: 7,
        original_title: "Podcast",
        original_idea: "Talk about stuff",
        refined_title: "Weekly founder interviews",
        refined_idea: "Thirty minutes with one early-stage founder.",
        improvements: ["Picked a format"],
        reasoning,
      };

      renderResult(result, "refinement");

      expect(screen.getByText("Podcast")).toBeInTheDocument();
      expect(screen.getByText("Talk about stuff")).toBeInTheDocument();
      expect(
        screen.getByRole("heading", { name: "Weekly founder interviews" }),
      ).toBeInTheDocument();
      expect(
        screen.getByText("Thirty minutes with one early-stage founder."),
      ).toBeInTheDocument();
      expect(screen.getByRole("listitem")).toHaveTextContent("Picked a format");
      expect(screen.queryByTestId("bucket-icon")).not.toBeInTheDocument();
    });

    it("shows legacy suggestions, one card each", () => {
      const result: LegacyRefinementResult = {
        reasoning,
        suggestions: [
          {
            bucket_id: 1,
            original_idea: "Blog",
            refined_idea: "Weekly teardown posts",
            improvements: ["Fixed cadence", "Clear format"],
          },
          {
            bucket_id: 2,
            original_idea: "Shop",
            refined_idea: "Print-on-demand posters",
            improvements: [],
          },
        ],
      };

      renderResult(result, "refinement");

      expect(
        screen.getAllByRole("heading").map((heading) => heading.textContent),
      ).toEqual(["Weekly teardown posts", "Print-on-demand posters"]);
      expect(screen.getByText("Blog")).toBeInTheDocument();
      expect(screen.getByText("Shop")).toBeInTheDocument();
      expect(
        screen.getByText("Fixed cadence · Clear format"),
      ).toBeInTheDocument();
    });

    it("renders RefinementCard directly for a bucket refinement", () => {
      render(<RefinementCard result={bucketRefinement} />);

      expect(
        screen.getByRole("heading", { name: "Habit tracker for runners" }),
      ).toBeInTheDocument();
    });
  });

  describe("gameplan", () => {
    it("hands the result to the gameplan view", () => {
      const result: GameplanResult = {
        bucket_id: 10,
        bucket_name: "Launch ideas",
        finish_line: "A live waitlist page with 50 signups.",
        where_you_are: "The copy is written.",
        first_step: { title: "Pick a form tool", detail: "Ten minutes." },
        phases: [],
        cut: [],
        risks: [],
      };

      renderResult(result, "gameplan");

      expect(
        screen.getByText("A live waitlist page with 50 signups."),
      ).toBeInTheDocument();
    });
  });
});
