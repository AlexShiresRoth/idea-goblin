// @vitest-environment node
import { AuthGuard } from "@/lib/auth/auth-guard";
import { db } from "@/lib/db";
import { ideaBucketsTable } from "@/lib/db/schema";
import type { SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeSession, mockQuery, userId } from "./helpers";

vi.mock("@/lib/auth/auth-guard", () => ({ AuthGuard: vi.fn() }));
vi.mock("@/lib/db", () => ({
  db: { select: vi.fn(), update: vi.fn(), delete: vi.fn(), insert: vi.fn() },
}));

import { POST } from "@/app/api/buckets/restore/route";

function request(body: unknown) {
  return new Request("http://localhost/api/buckets/restore", {
    method: "POST", body: JSON.stringify(body),
  });
}

function whereOf(query: ReturnType<typeof mockQuery>) {
  const where = query.where as ReturnType<typeof vi.fn>;
  return new PgDialect().sqlToQuery(where.mock.calls[0][0] as SQL);
}

describe("POST /api/buckets/restore", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(AuthGuard).mockResolvedValue(makeSession() as never);
  });

  it("requires authentication", async () => {
    vi.mocked(AuthGuard).mockResolvedValue(null as never);
    expect((await POST(request({ bucketId: 10 }))).status).toBe(401);
    expect(db.update).not.toHaveBeenCalled();
  });

  it.each([{}, null, { bucketId: null }])("rejects missing IDs: %j", async (body) => {
    const response = await POST(request(body));
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Bucket ID is required" });
    expect(db.update).not.toHaveBeenCalled();
  });

  it.each([0, -1, 1.5, "", "10junk", "1.5", "1e1", "0x10", " 10 ", "+10", "-10", "0", true, [], {}, Number.MAX_SAFE_INTEGER + 1, "9007199254740992"])(
    "rejects invalid IDs: %j",
    async (bucketId) => {
      expect((await POST(request({ bucketId }))).status).toBe(400);
      expect(db.update).not.toHaveBeenCalled();
    },
  );

  it("rejects malformed JSON", async () => {
    const response = await POST(new Request("http://localhost/api/buckets/restore", {
      method: "POST", body: "{",
    }));
    expect(response.status).toBe(400);
    expect(db.update).not.toHaveBeenCalled();
  });

  it.each([10, "10"])("restores %j parked and unshared without checking focus quota or duplicating resources", async (bucketId) => {
    const query = mockQuery([{ id: 10 }]);
    vi.mocked(db.update).mockReturnValue(query as never);
    const before = Date.now();

    const response = await POST(request({ bucketId }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ message: "Bucket restored successfully" });
    expect(db.update).toHaveBeenCalledExactlyOnceWith(ideaBucketsTable);
    expect(query.set).toHaveBeenCalledExactlyOnceWith({
      deletedAt: null, activeSince: null, shareToken: null, updatedAt: expect.any(Date),
    });
    const set = query.set as ReturnType<typeof vi.fn>;
    expect(set.mock.calls[0][0].updatedAt.getTime()).toBeGreaterThanOrEqual(before);
    const where = whereOf(query);
    expect(where.params).toEqual([10, userId]);
    expect(where.sql).toContain('"idea_buckets"."id" = $1');
    expect(where.sql).toContain('"idea_buckets"."profile_id" = $2');
    expect(where.sql).toContain('"idea_buckets"."deleted_at" is not null');
    expect(db.select).not.toHaveBeenCalled();
    expect(db.insert).not.toHaveBeenCalled();
    expect(db.delete).not.toHaveBeenCalled();
  });

  it("returns 404 for a missing, foreign-owned, or non-deleted bucket", async () => {
    vi.mocked(db.update).mockReturnValue(mockQuery([]) as never);
    const response = await POST(request({ bucketId: 10 }));
    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: "Bucket not found" });
    expect(db.insert).not.toHaveBeenCalled();
    expect(db.delete).not.toHaveBeenCalled();
  });

  it("cannot restore the same bucket twice", async () => {
    const repeated = mockQuery([]);
    vi.mocked(db.update)
      .mockReturnValueOnce(mockQuery([{ id: 10 }]) as never)
      .mockReturnValueOnce(repeated as never);
    expect((await POST(request({ bucketId: 10 }))).status).toBe(200);
    expect((await POST(request({ bucketId: 10 }))).status).toBe(404);
    expect(whereOf(repeated).sql).toContain('"idea_buckets"."deleted_at" is not null');
    expect(db.insert).not.toHaveBeenCalled();
  });
});
