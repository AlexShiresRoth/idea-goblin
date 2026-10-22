import { getAnalysisResults } from "@/lib/api/analysis";
import type { AnalysisResult } from "@/lib/db/schema";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { userId } from "./helpers";

vi.mock("@/lib/api/analysis", () => ({ getAnalysisResults: vi.fn() }));
vi.mock("@/app/components/delete-analysis-button", () => ({
  DeleteAnalysisButton: () => null,
}));

import AnalysisPage from "@/app/main/analysis/page";

function makeAnalysis(id: number): AnalysisResult {
  return {
    id,
    profileId: userId,
    analysisType: "execution",
    bucketId: null,
    analysisData: { summary: `Summary ${id}` } as never,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  };
}

async function renderPage(params: Record<string, string> = {}) {
  render(
    await AnalysisPage({
      searchParams: Promise.resolve(params),
    } as never),
  );
}

function mockPage(count: number, total: number) {
  vi.mocked(getAnalysisResults).mockResolvedValue({
    items: Array.from({ length: count }, (_, i) => makeAnalysis(i + 1)),
    total,
  });
}

describe("AnalysisPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("requests the first page of everything by default", async () => {
    mockPage(2, 2);

    await renderPage();

    expect(getAnalysisResults).toHaveBeenCalledWith({
      type: undefined,
      page: 1,
      pageSize: 10,
    });
    expect(screen.getByText("Summary 1")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "All" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.queryByLabelText("Next page")).not.toBeInTheDocument();
  });

  it("shows the default empty state", async () => {
    mockPage(0, 0);

    await renderPage();

    expect(screen.getByText(/No saved analyses yet/)).toBeInTheDocument();
  });

  it("filters by type and shows a type-specific empty state", async () => {
    mockPage(0, 0);

    await renderPage({ type: "refinement" });

    expect(getAnalysisResults).toHaveBeenCalledWith(
      expect.objectContaining({ type: "refinement" }),
    );
    expect(
      screen.getByText("No saved idea refinement results yet."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Idea Refinement" }),
    ).toHaveAttribute("aria-current", "page");
  });

  it("filters by gameplan", async () => {
    mockPage(0, 0);

    await renderPage({ type: "gameplan" });

    expect(getAnalysisResults).toHaveBeenCalledWith(
      expect.objectContaining({ type: "gameplan" }),
    );
    expect(screen.getByRole("link", { name: "Gameplan" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("ignores unknown types and invalid pages", async () => {
    mockPage(1, 1);

    await renderPage({ type: "analysis", page: "-2" });

    expect(getAnalysisResults).toHaveBeenCalledWith({
      type: undefined,
      page: 1,
      pageSize: 10,
    });
  });

  it("links filter tabs back to the first page", async () => {
    mockPage(10, 25);

    await renderPage({ type: "execution", page: "2" });

    expect(screen.getByRole("link", { name: "All" })).toHaveAttribute(
      "href",
      "/main/analysis",
    );
    expect(
      screen.getByRole("link", { name: "Idea Execution" }),
    ).toHaveAttribute("href", "/main/analysis?type=execution");
  });

  it("links to the previous and next pages, keeping the filter", async () => {
    mockPage(10, 25);

    await renderPage({ type: "execution", page: "2" });

    expect(screen.getByText("2 / 3")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Previous page" })).toHaveAttribute(
      "href",
      "/main/analysis?type=execution",
    );
    expect(screen.getByRole("link", { name: "Next page" })).toHaveAttribute(
      "href",
      "/main/analysis?type=execution&page=3",
    );
  });

  it("disables previous on the first page and next on the last", async () => {
    mockPage(10, 25);
    await renderPage();

    expect(
      screen.queryByRole("link", { name: "Previous page" }),
    ).not.toBeInTheDocument();
    expect(screen.getByLabelText("Previous page")).toHaveAttribute(
      "aria-disabled",
    );
    expect(screen.getByRole("link", { name: "Next page" })).toHaveAttribute(
      "href",
      "/main/analysis?page=2",
    );
  });

  it("falls back to the last page when the requested page is past the end", async () => {
    vi.mocked(getAnalysisResults)
      .mockResolvedValueOnce({ items: [], total: 15 })
      .mockResolvedValueOnce({ items: [makeAnalysis(11)], total: 15 });

    await renderPage({ page: "5" });

    expect(getAnalysisResults).toHaveBeenCalledTimes(2);
    expect(getAnalysisResults).toHaveBeenLastCalledWith({
      type: undefined,
      page: 2,
      pageSize: 10,
    });
    expect(screen.getByText("2 / 2")).toBeInTheDocument();
    expect(screen.getByText("Summary 11")).toBeInTheDocument();
    expect(screen.getByLabelText("Next page")).toHaveAttribute("aria-disabled");
  });
});
