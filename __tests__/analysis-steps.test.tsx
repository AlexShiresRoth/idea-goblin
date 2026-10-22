import {
  AnalysisSteps,
  type AnalysisStep,
} from "@/app/components/analysis-steps";
import { act, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const START = new Date("2026-10-22T12:00:00Z").getTime();

function steps(): AnalysisStep[] {
  return [
    { step: "load", message: "Loading your ideas", startedAt: START - 5000 },
    { step: "think", message: "Thinking it over", startedAt: START },
  ];
}

// lucide renders an svg with a class naming the icon.
function iconOf(text: string) {
  const item = screen.getByText(text).closest("li")!;
  const svg = item.querySelector("svg")!;
  return svg.getAttribute("class") ?? "";
}

describe("AnalysisSteps", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(START);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders nothing without steps", () => {
    const { container } = render(<AnalysisSteps steps={[]} running />);

    expect(container).toBeEmptyDOMElement();
  });

  it("lists every step in order", () => {
    render(<AnalysisSteps steps={steps()} running />);

    const items = within(screen.getByRole("list")).getAllByRole("listitem");
    expect(items.map((item) => item.textContent)).toEqual([
      "Loading your ideas",
      "Thinking it over",
    ]);
  });

  it("marks earlier steps done and spins the last one while running", () => {
    render(<AnalysisSteps steps={steps()} running />);

    expect(iconOf("Loading your ideas")).toMatch(/lucide-check/);
    expect(iconOf("Thinking it over")).toMatch(/animate-spin/);
  });

  it("marks the last step done once finished", () => {
    render(<AnalysisSteps steps={steps()} running={false} />);

    expect(iconOf("Loading your ideas")).toMatch(/lucide-check/);
    expect(iconOf("Thinking it over")).toMatch(/lucide-check/);
  });

  it("marks only the last step failed", () => {
    render(<AnalysisSteps steps={steps()} running={false} failed />);

    expect(iconOf("Loading your ideas")).toMatch(/lucide-check/);
    expect(iconOf("Thinking it over")).toMatch(/lucide-x/);
    expect(screen.getByText("Thinking it over").closest("li")).toHaveClass(
      "text-red-400",
    );
  });

  it("keeps spinning rather than failing while still running", () => {
    render(<AnalysisSteps steps={steps()} running failed />);

    expect(iconOf("Thinking it over")).toMatch(/animate-spin/);
  });

  it("shows elapsed seconds on the running step after three seconds", () => {
    render(<AnalysisSteps steps={steps()} running />);
    const current = screen.getByText("Thinking it over").closest("li")!;

    act(() => vi.advanceTimersByTime(2000));
    expect(current).toHaveTextContent(/^Thinking it over$/);

    act(() => vi.advanceTimersByTime(1000));
    expect(current).toHaveTextContent("3s");

    act(() => vi.advanceTimersByTime(4000));
    expect(current).toHaveTextContent("7s");
  });

  it("never shows elapsed time on finished steps", () => {
    render(<AnalysisSteps steps={steps()} running />);

    act(() => vi.advanceTimersByTime(5000));

    // The first step started 10s ago by now, but it is done.
    expect(
      screen.getByText("Loading your ideas").closest("li"),
    ).toHaveTextContent(/^Loading your ideas$/);
  });

  it("drops the elapsed time once the run stops", () => {
    const { rerender } = render(<AnalysisSteps steps={steps()} running />);
    act(() => vi.advanceTimersByTime(4000));
    expect(screen.getByText("4s")).toBeInTheDocument();

    rerender(<AnalysisSteps steps={steps()} running={false} />);

    expect(screen.queryByText(/\d+s$/)).not.toBeInTheDocument();
    act(() => vi.advanceTimersByTime(5000));
    expect(screen.queryByText(/\d+s$/)).not.toBeInTheDocument();
  });
});
