import { db } from "@/lib/db";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockQuery } from "./helpers";

vi.mock("@/lib/db", () => ({
  db: {
    update: vi.fn(),
  },
}));

import { touchBuckets } from "@/lib/api/buckets";

describe("touchBuckets", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does nothing for an empty list", async () => {
    await touchBuckets([]);
    expect(db.update).not.toHaveBeenCalled();
  });

  it("sets updatedAt to now on the given buckets", async () => {
    const query = mockQuery(undefined);
    vi.mocked(db.update).mockReturnValue(query as never);
    const before = Date.now();

    await touchBuckets([9, 10]);

    expect(db.update).toHaveBeenCalledTimes(1);
    const [{ updatedAt }] = vi.mocked(query.set as never as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(updatedAt.getTime()).toBeGreaterThanOrEqual(before);
    expect(query.where).toHaveBeenCalledTimes(1);
  });
});
