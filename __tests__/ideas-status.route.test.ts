// @vitest-environment node
import { touchBuckets } from "@/lib/api/buckets";
import { AuthGuard } from "@/lib/auth/auth-guard";
import { db } from "@/lib/db";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeSession, mockQuery } from "./helpers";

vi.mock("@/lib/auth/auth-guard", () => ({ AuthGuard: vi.fn() }));
vi.mock("@/lib/api/buckets", () => ({ touchBuckets: vi.fn() }));
vi.mock("@/lib/db", () => ({
  db: { select: vi.fn(), update: vi.fn() },
}));

import { POST } from "@/app/api/ideas/status/route";

function mark(body: unknown) {
  return POST(
    new Request("http://localhost/api/ideas/status", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  );
}

describe("POST /api/ideas/status", () => {
  let updateQuery: ReturnType<typeof mockQuery>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(AuthGuard).mockResolvedValue(makeSession() as never);
    updateQuery = mockQuery([{ id: 3, status: "done" }]);
    vi.mocked(db.update).mockReturnValue(updateQuery as never);
    vi.mocked(db.select).mockReturnValue(
      mockQuery([{ bucketId: 10 }, { bucketId: 11 }]) as never,
    );
  });

  it.each([
    ["no idea id", { done: true }],
    ["no done flag", { ideaId: 3 }],
    ["a non-boolean done", { ideaId: 3, done: "yes" }],
  ])("rejects %s", async (_label, body) => {
    const response = await mark(body);
    expect(response.status).toBe(400);
    expect(db.update).not.toHaveBeenCalled();
  });

  it("marks an idea done and touches its buckets", async () => {
    const response = await mark({ ideaId: 3, done: true });

    expect(response.status).toBe(200);
    expect(updateQuery.set).toHaveBeenCalledWith(
      expect.objectContaining({ status: "done" }),
    );
    expect(touchBuckets).toHaveBeenCalledWith([10, 11]);
  });

  it("reopens an idea", async () => {
    await mark({ ideaId: 3, done: false });

    expect(updateQuery.set).toHaveBeenCalledWith(
      expect.objectContaining({ status: "incubating" }),
    );
  });

  it("returns 404 for another user's idea", async () => {
    vi.mocked(db.update).mockReturnValue(mockQuery([]) as never);

    const response = await mark({ ideaId: 3, done: true });

    expect(response.status).toBe(404);
    expect(touchBuckets).not.toHaveBeenCalled();
  });
});
