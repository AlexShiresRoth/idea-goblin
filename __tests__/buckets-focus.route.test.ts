// @vitest-environment node
import { ensureProfile } from "@/lib/api/profiles";
import { AuthGuard } from "@/lib/auth/auth-guard";
import { db } from "@/lib/db";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeSession, mockQuery } from "./helpers";

vi.mock("@/lib/auth/auth-guard", () => ({ AuthGuard: vi.fn() }));
vi.mock("@/lib/api/profiles", () => ({ ensureProfile: vi.fn() }));
vi.mock("@/lib/db", () => ({
  db: { select: vi.fn(), transaction: vi.fn() },
}));

import { POST } from "@/app/api/buckets/focus/route";

function focus(body: unknown) {
  return POST(
    new Request("http://localhost/api/buckets/focus", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  );
}

describe("POST /api/buckets/focus", () => {
  let updates: { set: unknown }[];

  beforeEach(() => {
    vi.clearAllMocks();
    updates = [];
    vi.mocked(AuthGuard).mockResolvedValue(makeSession() as never);
    vi.mocked(ensureProfile).mockResolvedValue({
      id: "user-1",
      activeIdeasAmt: 2,
    } as never);
    vi.mocked(db.select).mockReturnValue(
      mockQuery([{ id: 10 }, { id: 11 }]) as never,
    );
    const tx = {
      update: vi.fn(() => {
        const query = mockQuery(undefined);
        query.set = vi.fn((set: unknown) => {
          updates.push({ set });
          return query;
        });
        return query;
      }),
    };
    vi.mocked(db.transaction).mockImplementation((async (
      run: (t: typeof tx) => unknown,
    ) => run(tx)) as never);
  });

  it("activates the chosen buckets and parks the rest", async () => {
    const response = await focus({ bucketIds: [10, 11, 10] });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ active: [10, 11] });
    expect(updates).toEqual([
      { set: { activeSince: null } },
      { set: { activeSince: expect.any(Date) } },
    ]);
  });

  it("parks everything when nothing is chosen", async () => {
    const response = await focus({ bucketIds: [] });

    expect(response.status).toBe(200);
    expect(db.select).not.toHaveBeenCalled();
    expect(updates).toEqual([{ set: { activeSince: null } }]);
  });

  it("refuses more buckets than the user's limit", async () => {
    const response = await focus({ bucketIds: [10, 11, 12] });

    expect(response.status).toBe(400);
    expect((await response.json()).error).toBe(
      "You can work on 2 buckets at once",
    );
    expect(db.transaction).not.toHaveBeenCalled();
  });

  it("uses the profile's own limit", async () => {
    vi.mocked(ensureProfile).mockResolvedValue({
      id: "user-1",
      activeIdeasAmt: 3,
    } as never);
    vi.mocked(db.select).mockReturnValue(
      mockQuery([{ id: 10 }, { id: 11 }, { id: 12 }]) as never,
    );

    expect((await focus({ bucketIds: [10, 11, 12] })).status).toBe(200);
  });

  it("returns 404 when a bucket isn't the user's", async () => {
    vi.mocked(db.select).mockReturnValue(mockQuery([{ id: 10 }]) as never);

    const response = await focus({ bucketIds: [10, 99] });

    expect(response.status).toBe(404);
    expect(db.transaction).not.toHaveBeenCalled();
  });

  it.each([
    ["no body", undefined],
    ["a non-array", { bucketIds: 10 }],
    ["a bad id", { bucketIds: [-1] }],
  ])("rejects %s", async (_label, body) => {
    expect((await focus(body)).status).toBe(400);
  });
});
