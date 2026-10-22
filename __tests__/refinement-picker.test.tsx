import { RefinementPicker } from "@/app/components/refinement-picker";
import type { RefinementFocusId } from "@/lib/constants";
import type { BucketOption } from "@/lib/types";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

const buckets: BucketOption[] = [
  { id: 1, name: "Tutor app", description: "Homework help", theme: "edu" },
  { id: 2, name: "Recipe swap", description: "Trade recipes", theme: "food" },
];

type Props = Parameters<typeof RefinementPicker>[0];

function renderPicker(props: Partial<Props> = {}) {
  const defaults: Props = {
    buckets,
    loading: false,
    recommending: false,
    selectedBucketId: null,
    onSelect: vi.fn(),
    onRecommend: vi.fn(),
    focus: [],
    onFocusChange: vi.fn(),
    note: "",
    onNoteChange: vi.fn(),
  };
  const merged = { ...defaults, ...props };
  render(<RefinementPicker {...merged} />);
  return merged;
}

describe("RefinementPicker", () => {
  it("shows a loading message instead of buckets while loading", () => {
    renderPicker({ loading: true });

    expect(screen.getByText("Digging out your buckets...")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Tutor app/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Let Goblin recommend" }),
    ).toBeDisabled();
  });

  it("shows an empty state when there are no buckets", () => {
    renderPicker({ buckets: [] });

    expect(
      screen.getByText("The hoard is empty. Add an idea first."),
    ).toBeInTheDocument();
  });

  it("selects a bucket when clicked", async () => {
    const user = userEvent.setup();
    const { onSelect } = renderPicker();

    await user.click(screen.getByRole("button", { name: /Recipe swap/ }));

    expect(onSelect).toHaveBeenCalledWith(buckets[1]);
  });

  it("asks Goblin to recommend a bucket", async () => {
    const user = userEvent.setup();
    const { onRecommend } = renderPicker();

    expect(
      screen.getByText(/Pick one, or let Goblin recommend\./),
    ).toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: "Let Goblin recommend" }),
    );

    expect(onRecommend).toHaveBeenCalledTimes(1);
  });

  it("shows a busy, disabled recommend button and the reason given", () => {
    renderPicker({
      recommending: true,
      recommendReason: "Tutor app has the most momentum.",
    });

    expect(
      screen.getByRole("button", { name: "The goblin is sniffing around..." }),
    ).toBeDisabled();
    expect(
      screen.getByText("Tutor app has the most momentum."),
    ).toBeInTheDocument();
  });

  it("hides the recommend option when scoped to one bucket", () => {
    renderPicker({ onRecommend: undefined });

    expect(
      screen.queryByRole("button", { name: "Let Goblin recommend" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/let Goblin recommend/)).not.toBeInTheDocument();
  });

  it("toggles focus chips on and off", async () => {
    const user = userEvent.setup();
    const focus: RefinementFocusId[] = ["concise"];
    const { onFocusChange } = renderPicker({ focus });

    const concise = screen.getByRole("button", { name: /More concise/ });
    const marketable = screen.getByRole("button", {
      name: /More marketable/,
    });
    expect(concise).toHaveAttribute("aria-pressed", "true");
    expect(marketable).toHaveAttribute("aria-pressed", "false");

    await user.click(marketable);
    expect(onFocusChange).toHaveBeenLastCalledWith(["concise", "marketable"]);

    await user.click(concise);
    expect(onFocusChange).toHaveBeenLastCalledWith([]);
  });

  it("reports note changes and counts characters", async () => {
    const user = userEvent.setup();
    const { onNoteChange } = renderPicker({ note: "indie devs" });

    expect(screen.getByText("10 / 300")).toBeInTheDocument();
    await user.type(screen.getByLabelText("Refinement note"), "!");

    expect(onNoteChange).toHaveBeenCalledWith("indie devs!");
  });

  it("drops the focus chips for a gameplan and asks for a planning note", () => {
    renderPicker({ pathway: "gameplan" });

    expect(
      screen.getByText("Anything Goblin should plan around?"),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /More concise/ }),
    ).not.toBeInTheDocument();
    expect(screen.getByLabelText("Gameplan note")).toHaveAttribute(
      "placeholder",
      "e.g. weekends only, solo, ship something within a month",
    );
  });
});
