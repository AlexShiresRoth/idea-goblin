import {
  RefinementReply,
  RefinementRounds,
} from "@/app/components/refinement-rounds";
import { MAX_REFINEMENT_ROUNDS } from "@/lib/constants";
import type {
  BucketRefinementResult,
  GameplanResult,
  Round,
} from "@/lib/types";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

const refinementDraft: BucketRefinementResult = {
  bucket_id: 1,
  original_name: "Tutor app",
  original_description: "Help kids with homework",
  refined_name: "Homework Hero",
  refined_description: "On-demand tutoring for middle schoolers",
  refined_category: "education",
  improvements: [],
  reasoning: { main_idea: "", reasons: [] },
};

const gameplanDraft: GameplanResult = {
  bucket_id: 1,
  bucket_name: "Tutor app",
  finish_line: "Ten paying families",
  where_you_are: "Just an idea",
  first_step: { title: "Call three parents", detail: "Ask what they pay" },
  phases: [],
  cut: [],
  risks: [],
};

describe("RefinementRounds", () => {
  it("renders nothing when there are no rounds", () => {
    const { container } = render(
      <RefinementRounds rounds={[]} disabled={false} onRestore={vi.fn()} />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it("lists each draft with the user's reply to it", () => {
    const rounds: Round<BucketRefinementResult | GameplanResult>[] = [
      { draft: refinementDraft, feedback: "Aim it at teachers" },
      { draft: gameplanDraft, feedback: "Make it weekends only" },
    ];

    render(
      <RefinementRounds rounds={rounds} disabled={false} onRestore={vi.fn()} />,
    );

    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(2);

    const first = within(items[0]);
    expect(first.getByText("Draft 1")).toBeInTheDocument();
    expect(first.getByText("Homework Hero")).toBeInTheDocument();
    expect(
      first.getByText("On-demand tutoring for middle schoolers"),
    ).toBeInTheDocument();
    expect(first.getByText("Aim it at teachers")).toBeInTheDocument();

    const second = within(items[1]);
    expect(second.getByText("Draft 2")).toBeInTheDocument();
    expect(second.getByText("Call three parents")).toBeInTheDocument();
    expect(second.getByText("Ten paying families")).toBeInTheDocument();
    expect(second.getByText("Make it weekends only")).toBeInTheDocument();
  });

  it("restores the chosen draft by index", async () => {
    const user = userEvent.setup();
    const onRestore = vi.fn();

    render(
      <RefinementRounds
        rounds={[
          { draft: refinementDraft, feedback: "one" },
          { draft: refinementDraft, feedback: "two" },
        ]}
        disabled={false}
        onRestore={onRestore}
      />,
    );

    const buttons = screen.getAllByRole("button", { name: "Go back to this" });
    await user.click(buttons[1]);

    expect(onRestore).toHaveBeenCalledWith(1);
  });

  it("disables restoring while a refinement is running", async () => {
    const user = userEvent.setup();
    const onRestore = vi.fn();

    render(
      <RefinementRounds
        rounds={[{ draft: gameplanDraft, feedback: "one" }]}
        disabled
        onRestore={onRestore}
      />,
    );

    const button = screen.getByRole("button", { name: "Go back to this" });
    expect(button).toBeDisabled();
    await user.click(button);
    expect(onRestore).not.toHaveBeenCalled();
  });
});

function Reply({
  initial = "",
  roundCount = 0,
  disabled = false,
  onSubmit,
  placeholder,
}: {
  initial?: string;
  roundCount?: number;
  disabled?: boolean;
  onSubmit: () => void;
  placeholder?: string;
}) {
  const [value, setValue] = useState(initial);
  return (
    <RefinementReply
      value={value}
      roundCount={roundCount}
      disabled={disabled}
      onChange={setValue}
      onSubmit={onSubmit}
      placeholder={placeholder}
    />
  );
}

describe("RefinementReply", () => {
  let onSubmit: Mock<() => void>;

  beforeEach(() => {
    onSubmit = vi.fn();
  });

  it("keeps Refine again disabled until there is a reply", async () => {
    const user = userEvent.setup();
    render(<Reply onSubmit={onSubmit} />);

    const button = screen.getByRole("button", { name: "Refine again" });
    expect(button).toBeDisabled();

    await user.type(screen.getByLabelText("Reply to this draft"), "   ");
    expect(button).toBeDisabled();

    await user.type(screen.getByLabelText("Reply to this draft"), "shorter");
    expect(button).toBeEnabled();

    await user.click(button);
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("does not submit a whitespace-only reply with Cmd+Enter", async () => {
    const user = userEvent.setup();
    render(<Reply onSubmit={onSubmit} initial="   " />);

    await user.click(screen.getByLabelText("Reply to this draft"));
    await user.keyboard("{Meta>}{Enter}{/Meta}");

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("submits with Cmd+Enter or Ctrl+Enter but not plain Enter", async () => {
    const user = userEvent.setup();
    render(<Reply onSubmit={onSubmit} initial="focus on teachers" />);

    const textarea = screen.getByLabelText("Reply to this draft");
    await user.click(textarea);

    await user.keyboard("{Enter}");
    expect(onSubmit).not.toHaveBeenCalled();

    await user.keyboard("{Meta>}{Enter}{/Meta}");
    expect(onSubmit).toHaveBeenCalledTimes(1);

    await user.keyboard("{Control>}{Enter}{/Control}");
    expect(onSubmit).toHaveBeenCalledTimes(2);
  });

  it("disables the reply while a refinement is running", () => {
    render(<Reply onSubmit={onSubmit} initial="focus on teachers" disabled />);

    expect(screen.getByLabelText("Reply to this draft")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Refine again" })).toBeDisabled();
  });

  it("counts characters against the 300 limit", async () => {
    const user = userEvent.setup();
    render(<Reply onSubmit={onSubmit} />);

    expect(screen.getByText("0 / 300")).toBeInTheDocument();
    await user.type(screen.getByLabelText("Reply to this draft"), "hello");
    expect(screen.getByText("5 / 300")).toBeInTheDocument();
    expect(screen.getByLabelText("Reply to this draft")).toHaveAttribute(
      "maxLength",
      "300",
    );
  });

  it("uses the default placeholder unless one is given", () => {
    const { unmount } = render(<Reply onSubmit={onSubmit} />);
    expect(
      screen.getByPlaceholderText(
        "e.g. keep the old name, but focus on teachers instead",
      ),
    ).toBeInTheDocument();
    unmount();

    render(<Reply onSubmit={onSubmit} placeholder="e.g. weekends only" />);
    expect(
      screen.getByPlaceholderText("e.g. weekends only"),
    ).toBeInTheDocument();
  });

  it("replaces the reply box with a message at the round limit", () => {
    render(<Reply onSubmit={onSubmit} roundCount={MAX_REFINEMENT_ROUNDS} />);

    expect(
      screen.getByText(
        `That's ${MAX_REFINEMENT_ROUNDS} rounds of back-and-forth. Keep the draft you like best, or start fresh.`,
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByLabelText("Reply to this draft"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Refine again" }),
    ).not.toBeInTheDocument();
  });

  it("still allows a reply one round before the limit", () => {
    render(
      <Reply onSubmit={onSubmit} roundCount={MAX_REFINEMENT_ROUNDS - 1} />,
    );

    expect(screen.getByLabelText("Reply to this draft")).toBeInTheDocument();
  });
});
