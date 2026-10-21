import { SavedGameplanView } from "@/app/components/saved-gameplan-view";
import { ToastContext } from "@/app/context/toast.provider";
import { hasStep, linkStep } from "@/lib/gameplan";
import type { GameplanResult } from "@/lib/types";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

const plan: GameplanResult = {
  bucket_id: 10,
  bucket_name: "Launch ideas",
  finish_line: "A live page.",
  where_you_are: "Nothing yet.",
  first_step: { title: "Pick a tool", detail: "Ten minutes." },
  phases: [
    {
      title: "Build",
      goal: "Ship it",
      steps: [
        { title: "Write copy", detail: "Short.", idea_id: null, effort: "low" },
        {
          title: "Ship page",
          detail: "One page.",
          idea_id: null,
          effort: "medium",
        },
      ],
    },
  ],
  cut: [],
  risks: [],
};

describe("linkStep", () => {
  it("links one phase step and leaves the rest alone", () => {
    const linked = linkStep(plan, { kind: "phase", phase: 0, step: 1 }, 9);

    expect(linked.phases[0].steps[1].idea_id).toBe(9);
    expect(linked.phases[0].steps[0].idea_id).toBeNull();
    expect(plan.phases[0].steps[1].idea_id).toBeNull();
  });

  it("links the first step", () => {
    expect(linkStep(plan, { kind: "first" }, 4).first_step.idea_id).toBe(4);
  });

  it("knows which steps exist", () => {
    expect(hasStep(plan, { kind: "phase", phase: 0, step: 1 })).toBe(true);
    expect(hasStep(plan, { kind: "phase", phase: 0, step: 2 })).toBe(false);
    expect(hasStep(plan, { kind: "phase", phase: 3, step: 0 })).toBe(false);
    expect(hasStep(plan, { kind: "first" })).toBe(true);
  });
});

describe("SavedGameplanView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("links the saved copy, so the step can't be added twice", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) =>
        url === "/api/ideas/create"
          ? ({ ok: true, json: async () => [{ id: 9 }] } as Response)
          : ({
              ok: true,
              json: async () =>
                linkStep(plan, { kind: "phase", phase: 0, step: 1 }, 9),
            } as Response),
      ),
    );
    const user = userEvent.setup();
    render(
      <ToastContext.Provider value={{ toasts: [], setToasts: vi.fn() }}>
        <SavedGameplanView
          analysisId={3}
          result={plan}
          ideas={[{ id: 9, title: "Ship page", status: "incubating" }]}
        />
      </ToastContext.Provider>,
    );
    expect(screen.getAllByRole("button", { name: "Add as idea" })).toHaveLength(
      3,
    );

    await user.click(screen.getAllByRole("button", { name: "Add as idea" })[2]);

    expect(fetch).toHaveBeenCalledWith("/api/analysis/link-step", {
      method: "POST",
      body: JSON.stringify({
        analysisId: 3,
        ideaId: 9,
        step: { kind: "phase", phase: 0, step: 1 },
      }),
    });
    expect(
      await screen.findByText("From your idea: Ship page"),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Add as idea" })).toHaveLength(
      2,
    );
  });
});
