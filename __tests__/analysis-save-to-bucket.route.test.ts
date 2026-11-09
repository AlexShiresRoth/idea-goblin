// @vitest-environment node
import { AuthGuard } from "@/lib/auth/auth-guard";
import { db } from "@/lib/db";
import { analysisResultsTable, ideaBucketsTable } from "@/lib/db/schema";
import { and, eq, ne, type SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { makeSession, mockQuery } from "./helpers";

vi.mock("@/lib/auth/auth-guard", () => ({ AuthGuard: vi.fn() }));
vi.mock("@/lib/db", () => ({
  db: {
    select: vi.fn(),
    transaction: vi.fn(),
    update: vi.fn(),
    insert: vi.fn(),
    delete: vi.fn(),
  },
}));

import { POST } from "@/app/api/analysis/save-to-bucket/route";

const plan = {
  bucket_id: 10,
  bucket_name: "Launch ideas",
  finish_line: "A live page.",
  where_you_are: "Nothing yet.",
  first_step: { title: "Pick a tool", detail: "Ten minutes." },
  phases: [],
  cut: [],
  risks: [],
};
const analysis = {
  id: 3,
  profileId: "user-1",
  analysisType: "gameplan",
  analysisData: plan,
  bucketId: null,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
};

function save(body: unknown) {
  return POST(
    new Request("http://localhost/api/analysis/save-to-bucket", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  );
}

function sql(condition: SQL | undefined) {
  return new PgDialect().sqlToQuery(condition!);
}

function expectWhere(
  query: ReturnType<typeof mockQuery>,
  condition: SQL | undefined,
) {
  expect(query.where).toHaveBeenCalledTimes(1);
  const actual = vi.mocked(query.where as (condition: SQL) => unknown).mock
    .calls[0][0];
  expect(sql(actual)).toEqual(sql(condition));
}

describe("POST /api/analysis/save-to-bucket", () => {
  let analysisQuery: ReturnType<typeof mockQuery>;
  let bucketQuery: ReturnType<typeof mockQuery>;
  let lockQuery: ReturnType<typeof mockQuery>;
  let detachQuery: ReturnType<typeof mockQuery>;
  let linkQuery: ReturnType<typeof mockQuery>;
  let tx: {
    select: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    insert: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(db.select).mockReset();
    vi.mocked(db.transaction).mockReset();
    vi.mocked(AuthGuard).mockResolvedValue(makeSession() as never);
    analysisQuery = mockQuery([analysis]);
    bucketQuery = mockQuery([{ id: 10 }]);
    vi.mocked(db.select)
      .mockReturnValueOnce(analysisQuery as never)
      .mockReturnValueOnce(bucketQuery as never);
    lockQuery = mockQuery([{ id: 10 }]);
    lockQuery.for = vi.fn(() => lockQuery);
    detachQuery = mockQuery(undefined);
    linkQuery = mockQuery([{ id: 3 }]);
    tx = {
      select: vi.fn(() => lockQuery),
      update: vi
        .fn()
        .mockReturnValueOnce(detachQuery)
        .mockReturnValueOnce(linkQuery),
      insert: vi.fn(),
      delete: vi.fn(),
    };
    vi.mocked(db.transaction).mockImplementation((async (
      run: (t: typeof tx) => unknown,
    ) => run(tx)) as never);
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("rejects unauthenticated requests before querying", async () => {
    vi.mocked(AuthGuard).mockResolvedValue(null);
    expect((await save({ analysisId: 3 })).status).toBe(401);
    expect(db.select).not.toHaveBeenCalled();
    expect(db.transaction).not.toHaveBeenCalled();
  });

  it.each([
    null,
    [],
    {},
    { analysisId: "3" },
    { analysisId: null },
    { analysisId: 0 },
    { analysisId: -1 },
    { analysisId: 1.5 },
    { analysisId: Number.MAX_SAFE_INTEGER + 1 },
  ])("rejects invalid input %j", async (body) => {
    expect((await save(body)).status).toBe(400);
    expect(db.select).not.toHaveBeenCalled();
    expect(db.transaction).not.toHaveBeenCalled();
  });

  it("rejects malformed JSON", async () => {
    const response = await POST(
      new Request("http://localhost/api/analysis/save-to-bucket", {
        method: "POST",
        body: "{",
      }),
    );
    expect(response.status).toBe(400);
    expect(db.select).not.toHaveBeenCalled();
  });

  it("404s for missing or nonowned analyses using an owner-scoped lookup", async () => {
    analysisQuery = mockQuery([]);
    vi.mocked(db.select)
      .mockReset()
      .mockReturnValueOnce(analysisQuery as never);
    expect((await save({ analysisId: 3 })).status).toBe(404);
    expectWhere(
      analysisQuery,
      and(
        eq(analysisResultsTable.id, 3),
        eq(analysisResultsTable.profileId, "user-1"),
      ),
    );
    expect(db.select).toHaveBeenCalledTimes(1);
    expect(db.transaction).not.toHaveBeenCalled();
  });

  it.each([
    { analysisType: "refinement" },
    { analysisData: { choices: [], summary: "Not a plan" } },
    { analysisData: null },
    { analysisData: "legacy malformed payload" },
    { analysisData: [] },
  ])("rejects ineligible analyses %j", async (overrides) => {
    vi.mocked(db.select)
      .mockReset()
      .mockReturnValueOnce(mockQuery([{ ...analysis, ...overrides }]) as never);
    expect((await save({ analysisId: 3 })).status).toBe(400);
    expect(db.select).toHaveBeenCalledTimes(1);
    expect(db.transaction).not.toHaveBeenCalled();
  });

  it.each([undefined, null, "10", 0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1])(
    "rejects invalid original bucket ID %j, even if already linked",
    async (bucketId) => {
      vi.mocked(db.select)
        .mockReset()
        .mockReturnValueOnce(
          mockQuery([
            {
              ...analysis,
              bucketId: 20,
              analysisData: { ...plan, bucket_id: bucketId },
            },
          ]) as never,
        );
      expect((await save({ analysisId: 3 })).status).toBe(400);
      expect(db.transaction).not.toHaveBeenCalled();
    },
  );

  it("404s for a missing or nonowned original bucket", async () => {
    bucketQuery = mockQuery([]);
    vi.mocked(db.select)
      .mockReset()
      .mockReturnValueOnce(analysisQuery as never)
      .mockReturnValueOnce(bucketQuery as never);
    expect((await save({ analysisId: 3 })).status).toBe(404);
    expectWhere(
      bucketQuery,
      and(
        eq(ideaBucketsTable.id, 10),
        eq(ideaBucketsTable.profileId, "user-1"),
      ),
    );
    expect(db.transaction).not.toHaveBeenCalled();
  });

  it("rolls back with 404 if the owned bucket disappears before locking", async () => {
    vi.mocked(lockQuery.for as () => unknown).mockResolvedValueOnce([]);

    const response = await save({ analysisId: 3 });

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "Bucket not found" });
    expect(tx.update).not.toHaveBeenCalled();
    await expect(
      vi.mocked(db.transaction).mock.results[0].value,
    ).rejects.toThrow("Bucket not found");
  });

  it("waits for the bucket lock before detaching or linking", async () => {
    let releaseLock!: (rows: { id: number }[]) => void;
    const locked = new Promise<{ id: number }[]>((resolve) => {
      releaseLock = resolve;
    });
    vi.mocked(lockQuery.for as () => unknown).mockReturnValueOnce(locked);

    const response = save({ analysisId: 3 });
    await vi.waitFor(() =>
      expect(lockQuery.for).toHaveBeenCalledWith("update"),
    );
    expect(tx.update).not.toHaveBeenCalled();
    releaseLock([{ id: 10 }]);

    expect((await response).status).toBe(200);
    expect(tx.update).toHaveBeenCalledTimes(2);
  });

  it("atomically detaches other owned gameplans and links a legacy unlinked record without inserting", async () => {
    const now = new Date("2026-11-08T12:00:00.000Z");
    vi.useFakeTimers();
    vi.setSystemTime(now);
    try {
      const response = await save({ analysisId: 3 });
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ bucketId: 10 });
      expectWhere(
        analysisQuery,
        and(
          eq(analysisResultsTable.id, 3),
          eq(analysisResultsTable.profileId, "user-1"),
        ),
      );
      expectWhere(
        bucketQuery,
        and(
          eq(ideaBucketsTable.id, 10),
          eq(ideaBucketsTable.profileId, "user-1"),
        ),
      );
      expect(db.transaction).toHaveBeenCalledTimes(1);
      expect(tx.select).toHaveBeenCalledWith({ id: ideaBucketsTable.id });
      expect(lockQuery.from).toHaveBeenCalledWith(ideaBucketsTable);
      expectWhere(
        lockQuery,
        and(
          eq(ideaBucketsTable.id, 10),
          eq(ideaBucketsTable.profileId, "user-1"),
        ),
      );
      expect(lockQuery.for).toHaveBeenCalledWith("update");
      expect(
        vi.mocked(lockQuery.for as () => unknown).mock.invocationCallOrder[0],
      ).toBeLessThan(tx.update.mock.invocationCallOrder[0]);
      expect(tx.update).toHaveBeenCalledTimes(2);
      expect(tx.update).toHaveBeenNthCalledWith(1, analysisResultsTable);
      expect(tx.update).toHaveBeenNthCalledWith(2, analysisResultsTable);
      expect(detachQuery.set).toHaveBeenCalledWith({ bucketId: null });
      expectWhere(
        detachQuery,
        and(
          eq(analysisResultsTable.profileId, "user-1"),
          eq(analysisResultsTable.bucketId, 10),
          eq(analysisResultsTable.analysisType, "gameplan"),
          ne(analysisResultsTable.id, 3),
        ),
      );
      expect(linkQuery.set).toHaveBeenCalledWith({
        bucketId: 10,
        updatedAt: now,
      });
      expectWhere(
        linkQuery,
        and(
          eq(analysisResultsTable.id, 3),
          eq(analysisResultsTable.profileId, "user-1"),
          eq(analysisResultsTable.analysisType, "gameplan"),
        ),
      );
      expect(
        vi.mocked(detachQuery.where as () => unknown).mock
          .invocationCallOrder[0],
      ).toBeLessThan(
        vi.mocked(linkQuery.set as () => unknown).mock.invocationCallOrder[0],
      );
      // Exact set assertions above preserve payloads and createdAt for history/restoring.
      expect(tx.insert).not.toHaveBeenCalled();
      expect(tx.delete).not.toHaveBeenCalled();
      expect(db.insert).not.toHaveBeenCalled();
      expect(db.delete).not.toHaveBeenCalled();
      expect(db.update).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it("reuses an already linked record on repeat saves without creating rows", async () => {
    vi.mocked(db.select)
      .mockReset()
      .mockImplementation(
        () => mockQuery([{ ...analysis, bucketId: 10 }]) as never,
      );
    tx.update.mockReset().mockImplementation(() => mockQuery([{ id: 3 }]));
    for (let attempt = 0; attempt < 2; attempt++) {
      const response = await save({ analysisId: 3 });
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ bucketId: 10 });
    }
    expect(db.transaction).toHaveBeenCalledTimes(2);
    expect(tx.update).toHaveBeenCalledTimes(4);
    expect(tx.insert).not.toHaveBeenCalled();
    expect(db.insert).not.toHaveBeenCalled();
  });

  it("targets the payload's original bucket, not a different current link", async () => {
    vi.mocked(db.select)
      .mockReset()
      .mockReturnValueOnce(mockQuery([{ ...analysis, bucketId: 20 }]) as never)
      .mockReturnValueOnce(bucketQuery as never);
    expect(await (await save({ analysisId: 3 })).json()).toEqual({
      bucketId: 10,
    });
    expect(linkQuery.set).toHaveBeenCalledWith({
      bucketId: 10,
      updatedAt: expect.any(Date),
    });
  });

  it("returns 500 when the analysis lookup fails", async () => {
    vi.mocked(db.select)
      .mockReset()
      .mockImplementationOnce(() => {
        throw new Error("db down");
      });
    expect((await save({ analysisId: 3 })).status).toBe(500);
    expect(db.transaction).not.toHaveBeenCalled();
  });

  it("rejects the transaction if linking fails, allowing the database to roll back detachment", async () => {
    vi.mocked(linkQuery.returning as () => unknown).mockRejectedValueOnce(
      new Error("link failed"),
    );
    expect((await save({ analysisId: 3 })).status).toBe(500);
    expect(detachQuery.where).toHaveBeenCalled();
    await expect(
      vi.mocked(db.transaction).mock.results[0].value,
    ).rejects.toThrow("link failed");
  });

  it("rejects the transaction if the ownership-guarded link no longer matches", async () => {
    vi.mocked(linkQuery.returning as () => unknown).mockResolvedValueOnce([]);
    expect((await save({ analysisId: 3 })).status).toBe(500);
    await expect(
      vi.mocked(db.transaction).mock.results[0].value,
    ).rejects.toThrow("Gameplan disappeared while saving to bucket");
  });
});
