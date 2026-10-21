import { GameplanView } from "@/app/components/gameplan-view";
import { ToastContext } from "@/app/context/toast.provider";
import type { GameplanResult } from "@/lib/types";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const refresh = vi.fn();
const setToasts = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
}));

const gameplan: GameplanResult = {
  bucket_id: 10,
  bucket_name: "Launch ideas",
  finish_line: "A live waitlist page with 50 signups.",
  where_you_are: "The copy is written.",
  first_step: { title: "Pick a form tool", detail: "Ten minutes, tops." },
  phases: [
    {
      title: "Build",
      goal: "Get it live",
      steps: [
        {
          title: "Write the copy",
          detail: "Already done.",
          idea_id: 1,
          effort: "low",
        },
        {
          title: "Ship the page",
          detail: "One page, one form.",
          idea_id: null,
          effort: "medium",
        },
      ],
    },
  ],
  cut: ["The referral program"],
  risks: ["Polishing forever"],
};

function renderView(props: Partial<Parameters<typeof GameplanView>[0]> = {}) {
  return render(
    <ToastContext.Provider value={{ toasts: [], setToasts }}>
      <GameplanView result={gameplan} {...props} />
    </ToastContext.Provider>,
  );
}

describe("GameplanView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));
  });

  it("shows the finish line, first step, phases, cuts and risks", () => {
    renderView();

    expect(
      screen.getByText("A live waitlist page with 50 signups."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Start today: Pick a form tool"),
    ).toBeInTheDocument();
    expect(screen.getByText("Build")).toBeInTheDocument();
    expect(screen.getByText("Ship the page")).toBeInTheDocument();
    expect(screen.getByText("The referral program")).toBeInTheDocument();
    expect(screen.getByText("Polishing forever")).toBeInTheDocument();
  });

  it("marks steps whose idea is done, using the bucket's ideas", () => {
    renderView({
      ideas: [{ id: 1, title: "Landing copy", status: "done" }],
    });

    expect(
      screen.getByText("From your idea: Landing copy"),
    ).toBeInTheDocument();
    expect(screen.getByText("Write the copy").className).toContain(
      "line-through",
    );
    expect(screen.getByText("Ship the page").className).not.toContain(
      "line-through",
    );
  });

  it("adds a step as an idea and links the step to it", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => [{ id: 77 }],
    } as Response);
    const onLink = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    renderView({ onLink });

    // The first step and the unlinked step can be added; the linked one can't.
    const buttons = screen.getAllByRole("button", { name: "Add as idea" });
    expect(buttons).toHaveLength(2);
    await user.click(buttons[1]);

    expect(fetch).toHaveBeenCalledWith("/api/ideas/create", {
      method: "POST",
      body: JSON.stringify({
        description: "Ship the page. One page, one form.",
        bucket: 10,
      }),
    });
    expect(onLink).toHaveBeenCalledWith(
      { kind: "phase", phase: 0, step: 1 },
      77,
    );
    expect(refresh).toHaveBeenCalled();
  });

  it("links the first step too", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => [{ id: 78 }],
    } as Response);
    const onLink = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    renderView({ onLink });

    await user.click(screen.getAllByRole("button", { name: "Add as idea" })[0]);

    expect(onLink).toHaveBeenCalledWith({ kind: "first" }, 78);
  });

  it("shows a linked first step as done when its idea is", () => {
    renderView({
      result: {
        ...gameplan,
        first_step: { ...gameplan.first_step, idea_id: 5 },
      },
      ideas: [{ id: 5, title: "Form tool", status: "done" }],
    });

    expect(screen.getByText("From your idea: Form tool")).toBeInTheDocument();
    expect(
      screen.getByText("Start today: Pick a form tool").className,
    ).toContain("line-through");
  });

  it("says so when the idea is added but the link fails", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => [{ id: 77 }],
    } as Response);
    const user = userEvent.setup();
    renderView({ onLink: vi.fn().mockRejectedValue(new Error("nope")) });

    await user.click(screen.getAllByRole("button", { name: "Add as idea" })[1]);

    await vi.waitFor(() =>
      expect(setToasts).toHaveBeenCalledWith([
        expect.objectContaining({
          message: "Added the idea, but couldn't link it to the plan",
          type: "error",
        }),
      ]),
    );
  });

  it("renders a partial plan while it streams", () => {
    renderView({ result: { phases: gameplan.phases } });

    expect(screen.getByText("Build")).toBeInTheDocument();
    expect(screen.queryByText("Finish line")).not.toBeInTheDocument();
    expect(screen.queryByText("0")).not.toBeInTheDocument();
  });
});
