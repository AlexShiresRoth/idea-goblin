import { getFocusLimit, getIdeaBuckets, getIdeasForBuckets } from "@/lib/api/";
import { getSession } from "@/lib/auth";
import type { IdeaBucket, IdeaView } from "@/lib/db/schema";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeBucket, makeIdea, userId } from "./helpers";

vi.mock("@/lib/api/", () => ({ getFocusLimit: vi.fn(), getIdeaBuckets: vi.fn(), getIdeasForBuckets: vi.fn() }));
vi.mock("@/lib/auth", () => ({ getSession: vi.fn() }));
vi.mock("@/app/components/create-idea-modal", () => ({ default: () => null }));
vi.mock("@/app/components/focus-provider", () => ({
  FocusProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
  FocusBar: () => <div>Working on</div>,
}));
vi.mock("@/app/main/upgraded-toast", () => ({ UpgradedToast: () => <div>Upgraded</div> }));
vi.mock("@/app/main/bucket", () => ({
  default: ({ bucket, ideas }: { bucket: IdeaBucket; ideas: IdeaView[] }) => (
    <div data-testid="board-bucket" data-bucket-id={bucket.id}>{bucket.name}: {ideas.map((idea) => idea.title).join(", ")}</div>
  ),
}));

import Main from "@/app/main/page";

async function renderPage(params: Record<string, string | string[]> = {}) {
  render(await Main({ searchParams: Promise.resolve(params) } as never));
}
function bucketOrder() {
  return screen.getAllByTestId("board-bucket").map((bucket) => Number(bucket.getAttribute("data-bucket-id")));
}

describe("bucket board sorting", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getSession).mockResolvedValue({ id: userId } as never);
    vi.mocked(getFocusLimit).mockResolvedValue(2);
    vi.mocked(getIdeaBuckets).mockResolvedValue([
      makeBucket({ id: 1, name: "Parked newest", activeSince: null, updatedAt: new Date("2026-11-04") }),
      makeBucket({ id: 2, name: "Active older", activeSince: new Date("2026-10-01"), updatedAt: new Date("2026-11-01") }),
      makeBucket({ id: 3, name: "Parked older", activeSince: null, updatedAt: new Date("2026-11-02") }),
      makeBucket({ id: 4, name: "Active newest", activeSince: new Date("2026-10-02"), updatedAt: new Date("2026-11-03") }),
    ]);
    vi.mocked(getIdeasForBuckets).mockResolvedValue(new Map([[2, [makeIdea({ title: "Still attached" })]]]));
  });

  it("defaults to most recently updated, regardless of focus", async () => {
    await renderPage();
    expect(bucketOrder()).toEqual([1, 4, 3, 2]);
    expect(screen.getByRole("link", { name: "Recently updated" })).toHaveAttribute("aria-current", "true");
    expect(screen.getByRole("navigation", { name: "Sort buckets" })).toBeInTheDocument();
    expect(screen.getByText("Active older: Still attached")).toBeInTheDocument();
    expect(getIdeasForBuckets).toHaveBeenCalledWith([1, 2, 3, 4]);
  });

  it("puts active buckets first, with each group ordered by last update", async () => {
    await renderPage({ sort: "active" });
    expect(bucketOrder()).toEqual([4, 2, 1, 3]);
    expect(screen.getByRole("link", { name: "Actively working on" })).toHaveAttribute("aria-current", "true");
    expect(screen.getByRole("link", { name: "Recently updated" })).not.toHaveAttribute("aria-current");
  });

  it("supports explicitly selecting recent updates", async () => {
    await renderPage({ sort: "updated" });
    expect(bucketOrder()).toEqual([1, 4, 3, 2]);
  });

  it.each(["invalid", ["active", "updated"]])("falls back to recent updates for an invalid sort (%j)", async (sort) => {
    await renderPage({ sort });
    expect(bucketOrder()).toEqual([1, 4, 3, 2]);
  });

  it("provides sort links and preserves other query parameters", async () => {
    await renderPage({ sort: "active", view: "board" });
    expect(screen.getByRole("link", { name: "Recently updated" })).toHaveAttribute("href", "/main?sort=updated&view=board");
    expect(screen.getByRole("link", { name: "Actively working on" })).toHaveAttribute("href", "/main?sort=active&view=board");
  });

  it("breaks tied timestamps deterministically by bucket ID", async () => {
    vi.mocked(getIdeaBuckets).mockResolvedValue([
      makeBucket({ id: 9, activeSince: null }), makeBucket({ id: 2, activeSince: null }),
    ]);
    await renderPage({ sort: "active" });
    expect(bucketOrder()).toEqual([2, 9]);
  });

  it("handles an empty board without a sort control", async () => {
    vi.mocked(getIdeaBuckets).mockResolvedValue([]);
    await renderPage();
    expect(screen.queryByTestId("board-bucket")).not.toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "Sort buckets" })).not.toBeInTheDocument();
  });

  it("does not load buckets when signed out", async () => {
    vi.mocked(getSession).mockResolvedValue(null);
    await renderPage();
    expect(getIdeaBuckets).not.toHaveBeenCalled();
    expect(getIdeasForBuckets).not.toHaveBeenCalled();
  });
});
