import { getFocusLimit, getIdeaBuckets, getIdeasForBuckets } from "@/lib/api/";
import { getSession } from "@/lib/auth";
import type { IdeaBucket, IdeaView } from "@/lib/db/schema";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeBucket, makeIdea, userId } from "./helpers";

const notFound = vi.fn(() => {
  throw new Error("NEXT_NOT_FOUND");
});

vi.mock("next/navigation", () => ({
  notFound: () => notFound(),
  useRouter: () => ({ refresh: vi.fn() }),
}));
vi.mock("@/lib/auth", () => ({ getSession: vi.fn() }));
vi.mock("@/lib/api/", () => ({
  getFocusLimit: vi.fn(),
  getIdeaBuckets: vi.fn(),
  getIdeasForBuckets: vi.fn(),
}));
vi.mock("@/app/main/bucket-detail", () => ({
  default: ({ bucket, ideas }: { bucket: IdeaBucket; ideas: IdeaView[] }) => (
    <div data-testid="bucket-detail" data-bucket-id={bucket.id}>
      {ideas.map((idea) => idea.title).join(", ")}
    </div>
  ),
}));

import BucketPage from "@/app/main/buckets/[id]/page";

async function renderPage(id: string) {
  render(await BucketPage({ params: Promise.resolve({ id }) }));
}

describe("bucket page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getSession).mockResolvedValue({ id: userId } as never);
    vi.mocked(getIdeaBuckets).mockResolvedValue([
      makeBucket({ id: 10 }),
      makeBucket({ id: 11, name: "Games" }),
    ]);
    vi.mocked(getFocusLimit).mockResolvedValue(2);
    vi.mocked(getIdeasForBuckets).mockResolvedValue(
      new Map([[11, [makeIdea({ title: "Board game" })]]]),
    );
  });

  it("shows the user's bucket with its ideas", async () => {
    await renderPage("11");

    expect(getIdeaBuckets).toHaveBeenCalledWith(userId);
    expect(getIdeasForBuckets).toHaveBeenCalledWith([11]);
    const detail = screen.getByTestId("bucket-detail");
    expect(detail).toHaveAttribute("data-bucket-id", "11");
    expect(detail).toHaveTextContent("Board game");
  });

  it("404s for a bucket the user doesn't own", async () => {
    await expect(renderPage("99")).rejects.toThrow("NEXT_NOT_FOUND");
    expect(getIdeasForBuckets).not.toHaveBeenCalled();
  });

  it("404s for an id that isn't a number", async () => {
    await expect(renderPage("10abc")).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("404s when signed out", async () => {
    vi.mocked(getSession).mockResolvedValue(null);

    await expect(renderPage("10")).rejects.toThrow("NEXT_NOT_FOUND");
    expect(getIdeaBuckets).not.toHaveBeenCalled();
  });
});
