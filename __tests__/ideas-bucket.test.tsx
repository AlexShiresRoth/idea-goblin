import IdeasBucket from "@/app/main/ideas-bucket";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { makeBucket, makeIdea } from "./helpers";

function renderCard(
  ideas = [makeIdea({ title: "Nested idea" })],
  bucket = makeBucket(),
) {
  return render(<IdeasBucket bucket={bucket} ideas={ideas} />);
}

function card() {
  return screen.getByRole("link", { name: /Launch ideas/ });
}

describe("IdeasBucket", () => {
  it("shows the bucket summary and links to its page", () => {
    renderCard();

    expect(screen.getByText("Launch ideas")).toBeInTheDocument();
    expect(screen.getByText("growth")).toBeInTheDocument();
    expect(screen.queryByText("Nested idea")).not.toBeInTheDocument();
    expect(card()).toHaveAttribute("href", "/main/buckets/10");
  });

  it("shows a done count", () => {
    renderCard([
      makeIdea({ id: 1, title: "Open one" }),
      makeIdea({ id: 2, title: "Finished one", status: "done" }),
      makeIdea({ id: 3, title: "Open two" }),
    ]);
    expect(screen.getByText("1 of 3 done")).toBeInTheDocument();
  });

  it("hides the done count when nothing is done", () => {
    renderCard();
    expect(screen.queryByText(/ done$/)).not.toBeInTheDocument();
  });

  it("shows the bucket's category icon", () => {
    renderCard(undefined, makeBucket({ category: "music" }));

    expect(screen.getByTestId("bucket-icon")).toHaveAttribute(
      "data-category",
      "music",
    );
  });

  // Set on the outermost element so the card's border can use them, not just
  // the theme pill inside it.
  it("sets the category colors on the card", () => {
    renderCard(undefined, makeBucket({ category: "music" }));

    expect(card().style.getPropertyValue("--bucket-primary")).toBe(
      "var(--color-fuchsia-400)",
    );
  });

  it("uses the default style for buckets without a category", () => {
    renderCard();

    expect(screen.getByTestId("bucket-icon")).toHaveAttribute(
      "data-category",
      "default",
    );
  });

  it("shows a parked bucket faded with a Parked badge", () => {
    renderCard();

    expect(screen.getByText("Parked")).toBeInTheDocument();
    expect(card().className).toContain("opacity-50");
  });

  it("shows an active bucket at full strength", () => {
    renderCard(undefined, makeBucket({ activeSince: new Date() }));

    expect(screen.getByText("Working on")).toBeInTheDocument();
    expect(screen.queryByText("Parked")).not.toBeInTheDocument();
    expect(card().className).not.toContain("opacity-50");
  });
});
