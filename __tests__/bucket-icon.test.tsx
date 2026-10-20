import { RefinementCard } from "@/app/components/analysis-result-condition";
import { BucketIcon, bucketStyleVars } from "@/app/components/bucket-icon";
import {
  BUCKET_CATEGORIES,
  BUCKET_CATEGORY_NAMES,
  DEFAULT_BUCKET_STYLE,
  bucketStyle,
  isBucketCategory,
} from "@/lib/constants";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

describe("bucket categories", () => {
  it("accepts only known categories", () => {
    expect(isBucketCategory("music")).toBe(true);
    expect(isBucketCategory("skull")).toBe(false);
    // Inherited object keys aren't categories.
    expect(isBucketCategory("toString")).toBe(false);
    expect(isBucketCategory(null)).toBe(false);
  });

  it("falls back to the default style", () => {
    expect(bucketStyle("music")).toBe(BUCKET_CATEGORIES.music);
    expect(bucketStyle("skull")).toBe(DEFAULT_BUCKET_STYLE);
    expect(bucketStyle(null)).toBe(DEFAULT_BUCKET_STYLE);
  });

  // Tailwind only emits palette variables written out in full in source.
  it.each(BUCKET_CATEGORY_NAMES)("%s uses full palette references", (name) => {
    const { primary, accent, tertiary } = BUCKET_CATEGORIES[name];
    for (const color of [primary, accent, tertiary]) {
      expect(color).toMatch(/^var\(--color-[a-z]+-\d{2,3}\)$/);
    }
  });

  it("exposes the colors as CSS variables", () => {
    expect(bucketStyleVars("music")).toEqual({
      "--bucket-primary": "var(--color-fuchsia-400)",
      "--bucket-accent": "var(--color-fuchsia-500)",
      "--bucket-tertiary": "var(--color-fuchsia-300)",
    });
  });
});

describe("BucketIcon", () => {
  it.each(BUCKET_CATEGORY_NAMES)("renders %s", (name) => {
    render(<BucketIcon category={name} />);

    const icon = screen.getByTestId("bucket-icon");
    expect(icon.tagName.toLowerCase()).toBe("svg");
    expect(icon).toHaveAttribute("data-category", name);
    expect(icon.style.getPropertyValue("--bucket-primary")).toBe(
      BUCKET_CATEGORIES[name].primary,
    );
  });

  it.each([null, undefined, "skull"])(
    "uses the default style for %s",
    (category) => {
      render(<BucketIcon category={category} />);

      const icon = screen.getByTestId("bucket-icon");
      expect(icon).toHaveAttribute("data-category", "default");
      expect(icon).toHaveClass("lucide-folder");
    },
  );
});

describe("RefinementCard", () => {
  const result = {
    bucket_id: 10,
    original_name: "Old",
    original_description: "Old description",
    refined_name: "Sharper",
    refined_description: "Sharper description",
    improvements: [],
    reasoning: { main_idea: "", reasons: [] },
  };

  it("previews the refined category", () => {
    render(
      <RefinementCard result={{ ...result, refined_category: "sports" }} />,
    );

    expect(screen.getByTestId("bucket-icon")).toHaveAttribute(
      "data-category",
      "sports",
    );
  });

  it("shows no icon for refinements saved before categories existed", () => {
    render(<RefinementCard result={result} />);

    expect(screen.queryByTestId("bucket-icon")).not.toBeInTheDocument();
  });
});
