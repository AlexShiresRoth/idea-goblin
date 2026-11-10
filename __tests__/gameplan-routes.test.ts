// @vitest-environment node
import { AuthGuard } from "@/lib/auth/auth-guard";
import { db } from "@/lib/db";
import type { SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
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
    const query = mockQuery([{ id: 5 }]);
    vi.mocked(db.select).mockReturnValue(query as never);

    const response = await saveBody({
      data: { finish_line: "f" },
      analysisType: "gameplan",
      bucketId: 5,
    });

    expect(response.status).toBe(200);
    const condition = vi.mocked(
      query.where as (condition: SQL) => unknown,
    ).mock.calls[0][0];
    expect(new PgDialect().sqlToQuery(condition).sql).toContain(
      '"idea_buckets"."deleted_at" is null',
    );
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
    vi.mocked(db.select)
      .mockReturnValueOnce(mockQuery([{ id: 5 }]) as never)
      .mockReturnValueOnce(query as never);

    const response = await get("?bucketId=5");

    expect(await response.json()).toEqual(saved);
    expect(query.limit).toHaveBeenCalledWith(1);
  });

  it("returns null when the bucket has none", async () => {
    vi.mocked(db.select)
      .mockReturnValueOnce(mockQuery([{ id: 5 }]) as never)
      .mockReturnValueOnce(mockQuery([]) as never);

    expect(await (await get("?bucketId=5")).json()).toBeNull();
  });

  it("returns 404 without loading plans for a missing, nonowned, or deleted bucket", async () => {
    const query = mockQuery([]);
    vi.mocked(db.select).mockReturnValueOnce(query as never);

    const response = await get("?bucketId=5");

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "Bucket not found" });
    expect(db.select).toHaveBeenCalledTimes(1);
    const condition = vi.mocked(
      query.where as (condition: SQL) => unknown,
    ).mock.calls[0][0];
    const { sql, params } = new PgDialect().sqlToQuery(condition);
    expect(sql).toContain('"idea_buckets"."deleted_at" is null');
    expect(params).toEqual([5, "user-1"]);
  });

  it.each(["", "?bucketId=abc", "?bucketId=-1"])(
    "rejects a missing or bad bucket id (%s)",
    async (query) => {
      expect((await get(query)).status).toBe(400);
    },
  );
});
