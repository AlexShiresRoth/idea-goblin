// @vitest-environment node
import { AuthGuard } from "@/lib/auth/auth-guard";
import { db } from "@/lib/db";
import { SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeSession, mockQuery } from "./helpers";

vi.mock("@/lib/auth/auth-guard", () => ({ AuthGuard: vi.fn() }));
vi.mock("@/lib/db", () => ({ db: { update: vi.fn() } }));

import { POST } from "@/app/api/buckets/share/route";

function share(body: unknown) {
  return POST(
    new Request("http://localhost/api/buckets/share", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  );
}

describe("POST /api/buckets/share", () => {
  let query: ReturnType<typeof mockQuery>;

  function mockUpdated(rows: unknown[]) {
    query = mockQuery(rows);
    vi.mocked(db.update).mockReturnValue(query as never);
  }

  function setShareToken() {
    const set = query.set as ReturnType<typeof vi.fn>;
    return (set.mock.calls[0][0] as { shareToken: unknown }).shareToken;
  }

  // The update's where clause as SQL, to check whose bucket it can touch.
  function whereQuery() {
    const where = query.where as ReturnType<typeof vi.fn>;
    return new PgDialect().sqlToQuery(where.mock.calls[0][0] as SQL);
  }

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(AuthGuard).mockResolvedValue(makeSession() as never);
    mockUpdated([{ shareToken: "tok" }]);
  });

  it("rejects signed-out requests", async () => {
    vi.mocked(AuthGuard).mockResolvedValue(null);

    const response = await share({ bucketId: 10, action: "enable" });

    expect(response.status).toBe(401);
    expect(db.update).not.toHaveBeenCalled();
  });

  it.each([
    {},
    { bucketId: 10 },
    { bucketId: "10", action: "enable" },
    { bucketId: 10, action: "publish" },
  ])("rejects an invalid body %j", async (body) => {
    const response = await share(body);

    expect(response.status).toBe(400);
    expect(db.update).not.toHaveBeenCalled();
  });

  it("turns sharing on, keeping a link that already exists", async () => {
    const response = await share({ bucketId: 10, action: "enable" });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ shareToken: "tok" });
    // coalesce(share_token, new) only fills in a missing token.
    expect(setShareToken()).toBeInstanceOf(SQL);
  });

  it("replaces the link with a new random token", async () => {
    await share({ bucketId: 10, action: "regenerate" });
    const first = setShareToken();
    mockUpdated([{ shareToken: "tok" }]);
    await share({ bucketId: 10, action: "regenerate" });

    expect(first).toMatch(/^[A-Za-z0-9_-]{22}$/);
    expect(setShareToken()).not.toBe(first);
  });

  it("turns sharing off", async () => {
    mockUpdated([{ shareToken: null }]);

    const response = await share({ bucketId: 10, action: "disable" });

    expect(await response.json()).toEqual({ shareToken: null });
    expect(setShareToken()).toBeNull();
  });

  it("404s when the bucket isn't the user's", async () => {
    mockUpdated([]);

    const response = await share({ bucketId: 99, action: "enable" });

    expect(response.status).toBe(404);
  });

  it("only updates a bucket the user owns", async () => {
    await share({ bucketId: 10, action: "enable" });

    const { sql, params } = whereQuery();
    expect(sql).toContain('"profile_id" = ');
    expect(params).toEqual(expect.arrayContaining([10, "user-1"]));
  });

  it("returns 500 when the update fails", async () => {
    vi.mocked(db.update).mockImplementation(() => {
      throw new Error("db down");
    });
    vi.spyOn(console, "error").mockImplementation(() => {});

    const response = await share({ bucketId: 10, action: "enable" });

    expect(response.status).toBe(500);
  });
});
