import { db } from "@/lib/db";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeIdea, mockSelect } from "./helpers";

vi.mock("@/lib/db", () => ({
  db: {
    select: vi.fn(),
  },
}));

import { getIdeasForBuckets } from "@/lib/api/ideas";

describe("getIdeasForBuckets", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns an empty map without querying when no bucket ids are given", async () => {
    const result = await getIdeasForBuckets([]);

    expect(result.size).toBe(0);
    expect(db.select).not.toHaveBeenCalled();
  });

  it("groups ideas by bucket and omits embeddings", async () => {
    const first = makeIdea({ id: 1, title: "One" });
    const second = makeIdea({ id: 2, title: "Two" });
    const select = mockSelect([
      { bucketId: 10, ...first },
      { bucketId: 10, ...second },
      { bucketId: 11, ...makeIdea({ id: 3, title: "Three" }) },
    ]);
    vi.mocked(db.select).mockReturnValue(select as never);

    const result = await getIdeasForBuckets([10, 11]);

    expect(db.select).toHaveBeenCalledTimes(1);
    expect(vi.mocked(db.select).mock.calls[0]?.[0]).not.toHaveProperty(
      "embedding",
    );
    expect(result.get(10)?.map((idea) => idea.title)).toEqual(["One", "Two"]);
    expect(result.get(11)?.map((idea) => idea.title)).toEqual(["Three"]);
    expect(result.get(10)?.[0]).not.toHaveProperty("embedding");
  });
});
