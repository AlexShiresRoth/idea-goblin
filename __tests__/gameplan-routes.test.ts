// @vitest-environment node
import { AuthGuard } from "@/lib/auth/auth-guard";
import { db } from "@/lib/db";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeSession, mockQuery } from "./helpers";

vi.mock("@/lib/auth/auth-guard", () => ({ AuthGuard: vi.fn() }));
vi.mock("@/lib/db", () => ({ db: { select: vi.fn(), insert: vi.fn() } }));

import { GET } from "@/app/api/buckets/gameplan/route";
import { POST as save } from "@/app/api/vault/save/route";

function saveBody(body: unknown) {
  return save(
    new Request("http://localhost/api/vault/save", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  );
}

describe("POST /api/vault/save", () => {
  let insertQuery: ReturnType<typeof mockQuery>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(AuthGuard).mockResolvedValue(makeSession() as never);
    insertQuery = mockQuery([{ id: 42 }]);
    vi.mocked(db.insert).mockReturnValue(insertQuery as never);
  });

  it("saves an analysis without a bucket", async () => {
    const response = await saveBody({
      data: { summary: "s" },
      analysisType: "execution",
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ id: 42 });
    expect(db.select).not.toHaveBeenCalled();
    expect(insertQuery.values).toHaveBeenCalledWith(
      expect.objectContaining({ analysisType: "execution", bucketId: null }),
    );
  });

  it("links a gameplan to the user's bucket", async () => {
    vi.mocked(db.select).mockReturnValue(mockQuery([{ id: 5 }]) as never);

    const response = await saveBody({
      data: { finish_line: "f" },
      analysisType: "gameplan",
      bucketId: 5,
    });

    expect(response.status).toBe(200);
    expect(insertQuery.values).toHaveBeenCalledWith(
      expect.objectContaining({ analysisType: "gameplan", bucketId: 5 }),
    );
  });

  it("refuses to link another user's bucket", async () => {
    vi.mocked(db.select).mockReturnValue(mockQuery([]) as never);

    const response = await saveBody({
      data: { finish_line: "f" },
      analysisType: "gameplan",
      bucketId: 99,
    });

    expect(response.status).toBe(404);
    expect(db.insert).not.toHaveBeenCalled();
  });
});

describe("GET /api/buckets/gameplan", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(AuthGuard).mockResolvedValue(makeSession() as never);
  });

  const get = (query: string) =>
    GET(new Request(`http://localhost/api/buckets/gameplan${query}`));

  it("returns the latest saved gameplan", async () => {
    const saved = {
      id: 3,
      createdAt: "2026-10-21",
      data: { finish_line: "f" },
    };
    const query = mockQuery([saved]);
    vi.mocked(db.select).mockReturnValue(query as never);

    const response = await get("?bucketId=5");

    expect(await response.json()).toEqual(saved);
    expect(query.limit).toHaveBeenCalledWith(1);
  });

  it("returns null when the bucket has none", async () => {
    vi.mocked(db.select).mockReturnValue(mockQuery([]) as never);

    expect(await (await get("?bucketId=5")).json()).toBeNull();
  });

  it.each(["", "?bucketId=abc", "?bucketId=-1"])(
    "rejects a missing or bad bucket id (%s)",
    async (query) => {
      expect((await get(query)).status).toBe(400);
    },
  );
});
