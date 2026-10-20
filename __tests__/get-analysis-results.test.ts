import { AuthGuard } from "@/lib/auth/auth-guard";
import { db } from "@/lib/db";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeSession, mockQuery } from "./helpers";

vi.mock("@/lib/auth/auth-guard", () => ({ AuthGuard: vi.fn() }));
vi.mock("@/lib/db", () => ({ db: { select: vi.fn() } }));

import { getAnalysisResults } from "@/lib/api/analysis";

function mockResults(items: unknown[], total: number) {
  const itemsQuery = mockQuery(items);
  const countQuery = mockQuery([{ total }]);
  vi.mocked(db.select)
    .mockReturnValueOnce(itemsQuery as never)
    .mockReturnValueOnce(countQuery as never);
  return { itemsQuery, countQuery };
}

describe("getAnalysisResults", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(AuthGuard).mockResolvedValue(makeSession() as never);
  });

  it("returns an empty page without querying when signed out", async () => {
    vi.mocked(AuthGuard).mockResolvedValue(null as never);

    expect(await getAnalysisResults()).toEqual({ items: [], total: 0 });
    expect(db.select).not.toHaveBeenCalled();
  });

  it("returns the page of items alongside the total count", async () => {
    const { itemsQuery } = mockResults([{ id: 1 }, { id: 2 }], 14);

    const result = await getAnalysisResults();

    expect(result).toEqual({ items: [{ id: 1 }, { id: 2 }], total: 14 });
    expect(itemsQuery.limit).toHaveBeenCalledWith(6);
    expect(itemsQuery.offset).toHaveBeenCalledWith(0);
  });

  it("offsets by page and page size", async () => {
    const { itemsQuery } = mockResults([], 30);

    await getAnalysisResults({ page: 3, pageSize: 10 });

    expect(itemsQuery.limit).toHaveBeenCalledWith(10);
    expect(itemsQuery.offset).toHaveBeenCalledWith(20);
  });

  it("applies the same filter to items and count", async () => {
    const { itemsQuery, countQuery } = mockResults([], 0);

    await getAnalysisResults({ type: "execution" });

    const itemsWhere = vi.mocked(itemsQuery.where as never as () => unknown)
      .mock.calls[0];
    const countWhere = vi.mocked(countQuery.where as never as () => unknown)
      .mock.calls[0];
    expect(itemsWhere).toBeDefined();
    expect(countWhere).toEqual(itemsWhere);
  });

  it("returns an empty page when the query fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(db.select).mockImplementation(() => {
      throw new Error("db down");
    });

    expect(await getAnalysisResults()).toEqual({ items: [], total: 0 });
  });
});
