// @vitest-environment node
import { AuthGuard } from "@/lib/auth/auth-guard";
import { db } from "@/lib/db";
import {
  bucketVersionsTable,
  ideaBucketLinksTable,
  ideaBucketsTable,
  ideasTable,
} from "@/lib/db/schema";
import { and, eq, inArray, isNull, type SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { makeBucket, makeSession, mockQuery } from "./helpers";

vi.mock("@/lib/auth/auth-guard", () => ({ AuthGuard: vi.fn() }));
vi.mock("@/lib/db", () => ({
  db: {
    transaction: vi.fn(),
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

import { POST } from "@/app/api/buckets/apply-refinement/route";

const bucket = makeBucket({ category: "software" });
const oldIdeas = [
  {
    id: 1,
    title: "Shared old idea",
    description: "Keep this for other buckets and version restore",
    category: "product",
    status: "growing",
    type: "idea",
  },
];
const selectedIdeas = [
  { title: "Chosen suggestion", description: "User-edited description" },
  { title: "Another suggestion", description: "Another description" },
];
const input = {
  bucketId: 10,
  name: "Refined bucket",
  description: "Refined description",
  category: "mobile",
  updateDetails: true,
  ideasMode: "add",
  ideas: selectedIdeas,
};

function apply(body: unknown = input) {
  return POST(
    new Request("http://localhost/api/buckets/apply-refinement", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  );
}

function expectWhere(
  query: ReturnType<typeof mockQuery>,
  condition: SQL | undefined,
) {
  const actual = vi.mocked(query.where as (condition: SQL) => unknown).mock
    .calls;
  expect(actual).toHaveLength(1);
  const dialect = new PgDialect();
  expect(dialect.sqlToQuery(actual[0][0])).toEqual(
    dialect.sqlToQuery(condition!),
  );
}

describe("POST /api/buckets/apply-refinement", () => {
  let lock: ReturnType<typeof mockQuery>;
  let current: ReturnType<typeof mockQuery>;
  let snapshot: ReturnType<typeof mockQuery>;
  let insertIdeas: ReturnType<typeof mockQuery>;
  let insertLinks: ReturnType<typeof mockQuery>;
  let removeLinks: ReturnType<typeof mockQuery>;
  let update: ReturnType<typeof mockQuery>;
  let tx: {
    select: ReturnType<typeof vi.fn>;
    insert: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(AuthGuard).mockResolvedValue(makeSession() as never);
    lock = mockQuery([bucket]);
    lock.for = vi.fn(() => lock);
    current = mockQuery(oldIdeas);
    current.for = vi.fn(() => current);
    snapshot = mockQuery(undefined);
    insertIdeas = mockQuery([{ id: 101 }, { id: 102 }]);
    insertLinks = mockQuery(undefined);
    removeLinks = mockQuery(undefined);
    update = mockQuery(undefined);
    tx = {
      select: vi.fn().mockReturnValueOnce(lock).mockReturnValueOnce(current),
      insert: vi.fn((table) => {
        if (table === bucketVersionsTable) return snapshot;
        if (table === ideasTable) return insertIdeas;
        if (table === ideaBucketLinksTable) return insertLinks;
        throw new Error("Unexpected insert");
      }),
      delete: vi.fn(() => removeLinks),
      update: vi.fn(() => update),
    };
    vi.mocked(db.transaction)
      .mockReset()
      .mockImplementation((async (run: (transaction: typeof tx) => unknown) =>
        run(tx)) as never);
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => vi.restoreAllMocks());

  it("requires authentication before reading input or querying", async () => {
    vi.mocked(AuthGuard).mockResolvedValue(null);
    expect((await apply(null)).status).toBe(401);
    expect(db.transaction).not.toHaveBeenCalled();
  });

  it.each([
    null,
    [],
    {},
    ...[0, -1, 1.5, "10", null, Number.MAX_SAFE_INTEGER + 1].map(
      (bucketId) => ({ ...input, bucketId }),
    ),
    ...["", "  ", "x".repeat(201), null, 123].map((name) => ({
      ...input,
      name,
    })),
    ...["", "  ", "x".repeat(4001), null, 123].map((description) => ({
      ...input,
      description,
    })),
    { ...input, category: null },
    { ...input, category: 123 },
    { ...input, updateDetails: "true" },
    { ...input, updateDetails: undefined },
    { ...input, ideasMode: "invalid" },
    { ...input, ideasMode: undefined },
    { ...input, ideas: undefined },
    { ...input, ideas: {} },
    { ...input, ideas: Array.from({ length: 31 }, () => selectedIdeas[0]) },
    ...[
      null,
      {},
      { title: "", description: "ok" },
      { title: "  ", description: "ok" },
      { title: "x".repeat(201), description: "ok" },
      { title: "ok", description: "" },
      { title: "ok", description: "  " },
      { title: "ok", description: "x".repeat(4001) },
      { title: 1, description: "ok" },
    ].map((idea) => ({ ...input, ideas: [idea] })),
    { ...input, ideasMode: "none" },
    { ...input, ideas: [] },
    { ...input, ideasMode: "replace", ideas: [] },
    { ...input, ideasMode: "none", ideas: [], updateDetails: false },
  ])("rejects invalid input %# without a transaction", async (body) => {
    expect((await apply(body)).status).toBe(400);
    expect(db.transaction).not.toHaveBeenCalled();
  });

  it("returns 400 for malformed JSON", async () => {
    const response = await POST(
      new Request("http://localhost/api/buckets/apply-refinement", {
        method: "POST",
        body: "{",
      }),
    );
    expect(response.status).toBe(400);
    expect(db.transaction).not.toHaveBeenCalled();
  });

  it.each(["missing", "nonowned", "deleted"])(
    "404s for a %s bucket with a live owner-scoped locking lookup",
    async () => {
      vi.mocked(lock.for as () => unknown).mockResolvedValueOnce([]);
      expect((await apply()).status).toBe(404);
      expectWhere(
        lock,
        and(
          eq(ideaBucketsTable.id, 10),
          eq(ideaBucketsTable.profileId, "user-1"),
          isNull(ideaBucketsTable.deletedAt),
        ),
      );
      expect(lock.for).toHaveBeenCalledWith("update");
      expect(tx.select).toHaveBeenCalledTimes(1);
      expect(tx.insert).not.toHaveBeenCalled();
      expect(tx.delete).not.toHaveBeenCalled();
      expect(tx.update).not.toHaveBeenCalled();
      await expect(
        vi.mocked(db.transaction).mock.results[0].value,
      ).rejects.toThrow("Bucket not found");
    },
  );

  it("waits for the owned bucket lock before reading or mutating its contents", async () => {
    let release!: (rows: (typeof bucket)[]) => void;
    const pending = new Promise<(typeof bucket)[]>((resolve) => {
      release = resolve;
    });
    vi.mocked(lock.for as () => unknown).mockReturnValueOnce(pending);
    const response = apply();
    await vi.waitFor(() => expect(lock.for).toHaveBeenCalledWith("update"));
    expect(tx.select).toHaveBeenCalledTimes(1);
    expect(tx.insert).not.toHaveBeenCalled();
    release([bucket]);
    expect((await response).status).toBe(200);
  });

  it("snapshots all old details and linked ideas before adding user-supplied ideas", async () => {
    const response = await apply();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ bucketId: 10, added: 2 });
    expect(db.transaction).toHaveBeenCalledTimes(1);
    expect(lock.from).toHaveBeenCalledWith(ideaBucketsTable);
    expectWhere(
      lock,
      and(
        eq(ideaBucketsTable.id, 10),
        eq(ideaBucketsTable.profileId, "user-1"),
        isNull(ideaBucketsTable.deletedAt),
      ),
    );
    expect(tx.select).toHaveBeenNthCalledWith(2, {
      id: ideasTable.id,
      title: ideasTable.title,
      description: ideasTable.description,
      category: ideasTable.category,
      status: ideasTable.status,
      type: ideasTable.type,
    });
    expect(current.from).toHaveBeenCalledWith(ideaBucketLinksTable);
    expect(current.innerJoin).toHaveBeenCalledWith(
      ideasTable,
      expect.anything(),
    );
    expectWhere(current, eq(ideaBucketLinksTable.bucketId, 10));
    expect(current.orderBy).toHaveBeenCalledWith(ideasTable.createdAt);
    expect(current.for).toHaveBeenCalledWith("update");
    expect(snapshot.values).toHaveBeenCalledWith({
      bucketId: 10,
      name: bucket.name,
      description: bucket.description,
      theme: bucket.theme,
      category: bucket.category,
      ideas: oldIdeas,
    });
    expect(tx.insert).toHaveBeenNthCalledWith(1, bucketVersionsTable);
    expect(tx.insert).toHaveBeenNthCalledWith(2, ideasTable);
    expect(tx.insert).toHaveBeenNthCalledWith(3, ideaBucketLinksTable);
    expect(insertIdeas.values).toHaveBeenCalledWith(
      selectedIdeas.map((idea) => ({
        ...idea,
        profileId: "user-1",
        category: "mobile",
        type: "idea",
        status: "incubating",
        embedding: null,
      })),
    );
    expect(insertIdeas.returning).toHaveBeenCalledWith({ id: ideasTable.id });
    expect(insertLinks.values).toHaveBeenCalledWith([
      { ideaId: 101, bucketId: 10 },
      { ideaId: 102, bucketId: 10 },
    ]);
    expect(tx.delete).not.toHaveBeenCalled();
    expect(tx.update).toHaveBeenCalledWith(ideaBucketsTable);
    expect(update.set).toHaveBeenCalledWith({
      name: input.name,
      description: input.description,
      category: "mobile",
      updatedAt: expect.any(Date),
    });
    expectWhere(update, eq(ideaBucketsTable.id, 10));
    expect(db.select).not.toHaveBeenCalled();
    expect(db.insert).not.toHaveBeenCalled();
    expect(db.update).not.toHaveBeenCalled();
    expect(db.delete).not.toHaveBeenCalled();
  });

  it("replace detaches only this bucket's open links after the snapshot, preserving shared idea rows", async () => {
    expect((await apply({ ...input, ideasMode: "replace" })).status).toBe(200);
    expect(tx.delete).toHaveBeenCalledExactlyOnceWith(ideaBucketLinksTable);
    expectWhere(
      removeLinks,
      and(
        eq(ideaBucketLinksTable.bucketId, 10),
        inArray(ideaBucketLinksTable.ideaId, [1]),
      ),
    );
    const order = (query: ReturnType<typeof mockQuery>, method: string) =>
      vi.mocked(query[method] as () => unknown).mock.invocationCallOrder[0];
    expect(order(snapshot, "values")).toBeLessThan(
      tx.delete.mock.invocationCallOrder[0],
    );
    expect(order(removeLinks, "where")).toBeLessThan(
      order(insertIdeas, "values"),
    );
    expect(order(insertLinks, "values")).toBeLessThan(order(update, "set"));
  });

  it("replace preserves done links while snapshotting all statuses, including legacy archived/completed ideas", async () => {
    // isDone recognizes only "done"; legacy status names are still open.
    const mixedIdeas = [
      "incubating",
      "done",
      "archived",
      "completed",
      "growing",
      "done",
    ].map((status, index) => ({ ...oldIdeas[0], id: index + 1, status }));
    vi.mocked(current.for as () => unknown).mockResolvedValueOnce(mixedIdeas);

    expect((await apply({ ...input, ideasMode: "replace" })).status).toBe(200);
    expect(snapshot.values).toHaveBeenCalledWith(
      expect.objectContaining({ ideas: mixedIdeas }),
    );
    expect(tx.delete).toHaveBeenCalledExactlyOnceWith(ideaBucketLinksTable);
    expectWhere(
      removeLinks,
      and(
        eq(ideaBucketLinksTable.bucketId, 10),
        inArray(ideaBucketLinksTable.ideaId, [1, 3, 4, 5]),
      ),
    );
    expect(insertLinks.values).toHaveBeenCalledWith([
      { ideaId: 101, bucketId: 10 },
      { ideaId: 102, bucketId: 10 },
    ]);
  });

  it.each(["all done", "empty"])(
    "replace skips deletion entirely when the bucket is %s but still snapshots and adds suggestions",
    async (state) => {
      const ideas =
        state === "all done"
          ? [1, 2].map((id) => ({ ...oldIdeas[0], id, status: "done" }))
          : [];
      vi.mocked(current.for as () => unknown).mockResolvedValueOnce(ideas);

      expect((await apply({ ...input, ideasMode: "replace" })).status).toBe(
        200,
      );
      expect(snapshot.values).toHaveBeenCalledWith(
        expect.objectContaining({ ideas }),
      );
      expect(tx.delete).not.toHaveBeenCalled();
      expect(removeLinks.where).not.toHaveBeenCalled();
      expect(tx.insert).toHaveBeenCalledWith(ideasTable);
      expect(insertLinks.values).toHaveBeenCalledWith([
        { ideaId: 101, bucketId: 10 },
        { ideaId: 102, bucketId: 10 },
      ]);
    },
  );

  it("waits for idea/status locks before snapshotting or replacing links", async () => {
    let release!: (rows: typeof oldIdeas) => void;
    const pending = new Promise<typeof oldIdeas>((resolve) => {
      release = resolve;
    });
    vi.mocked(current.for as () => unknown).mockReturnValueOnce(pending);
    const response = apply({ ...input, ideasMode: "replace" });
    await vi.waitFor(() => expect(current.for).toHaveBeenCalledWith("update"));
    expect(tx.insert).not.toHaveBeenCalled();
    expect(tx.delete).not.toHaveBeenCalled();
    release([{ ...oldIdeas[0], status: "done" }]);
    expect((await response).status).toBe(200);
    expect(snapshot.values).toHaveBeenCalledWith(
      expect.objectContaining({ ideas: [{ ...oldIdeas[0], status: "done" }] }),
    );
    expect(tx.delete).not.toHaveBeenCalled();
  });

  it("none applies only details while snapshotting the current ideas", async () => {
    const response = await apply({ ...input, ideasMode: "none", ideas: [] });
    expect(await response.json()).toEqual({ bucketId: 10, added: 0 });
    expect(tx.insert).toHaveBeenCalledExactlyOnceWith(bucketVersionsTable);
    expect(tx.delete).not.toHaveBeenCalled();
    expect(update.set).toHaveBeenCalledWith({
      name: input.name,
      description: input.description,
      category: "mobile",
      updatedAt: expect.any(Date),
    });
  });

  it.each(["add", "replace"])(
    "%s without details still touches updatedAt but preserves name, description and category",
    async (ideasMode) => {
      expect(
        (await apply({ ...input, ideasMode, updateDetails: false })).status,
      ).toBe(200);
      expect(update.set).toHaveBeenCalledExactlyOnceWith({
        updatedAt: expect.any(Date),
      });
    },
  );

  it.each([
    [undefined, "software", "software"],
    ["unknown", "software", "software"],
    ["__proto__", null, "general"],
    ["unknown", "legacy-category", "legacy-category"],
    ["mobile", null, "mobile"],
  ])(
    "uses category %j with current category %j as %j",
    async (category, currentCategory, expected) => {
      vi.mocked(lock.for as () => unknown).mockResolvedValueOnce([
        { ...bucket, category: currentCategory },
      ]);
      expect((await apply({ ...input, category })).status).toBe(200);
      expect(insertIdeas.values).toHaveBeenCalledWith(
        selectedIdeas.map((idea) =>
          expect.objectContaining({ ...idea, category: expected }),
        ),
      );
      expect(update.set).toHaveBeenCalledWith({
        name: input.name,
        description: input.description,
        ...(category === "mobile" && { category }),
        updatedAt: expect.any(Date),
      });
    },
  );

  it("accepts maximum lengths and 30 ideas", async () => {
    const ideas = Array.from({ length: 30 }, () => ({
      title: "x".repeat(200),
      description: "y".repeat(4000),
    }));
    const response = await apply({
      ...input,
      name: "x".repeat(200),
      description: "y".repeat(4000),
      ideas,
    });
    expect(await response.json()).toEqual({ bucketId: 10, added: 30 });
    expect(insertIdeas.values).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining(ideas[0])]),
    );
  });

  it("trims editable strings", async () => {
    expect(
      (
        await apply({
          ...input,
          name: " Name ",
          description: " Description ",
          ideas: [{ title: " Title ", description: " Detail " }],
        })
      ).status,
    ).toBe(200);
    expect(update.set).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Name", description: "Description" }),
    );
    expect(insertIdeas.values).toHaveBeenCalledWith([
      expect.objectContaining({ title: "Title", description: "Detail" }),
    ]);
  });

  it.each(["snapshot", "delete", "ideas", "links", "update"] as const)(
    "rejects the transaction on %s failure so all preceding writes can roll back",
    async (stage) => {
      const failures = {
        snapshot: [snapshot, "values"],
        delete: [removeLinks, "where"],
        ideas: [insertIdeas, "returning"],
        links: [insertLinks, "values"],
        update: [update, "where"],
      } as const;
      const [query, method] = failures[stage];
      vi.mocked(query[method] as () => unknown).mockRejectedValueOnce(
        new Error(`${stage} failed`),
      );
      expect((await apply({ ...input, ideasMode: "replace" })).status).toBe(
        500,
      );
      await expect(
        vi.mocked(db.transaction).mock.results[0].value,
      ).rejects.toThrow(`${stage} failed`);
      if (stage === "snapshot") {
        expect(tx.delete).not.toHaveBeenCalled();
        expect(tx.update).not.toHaveBeenCalled();
      }
      if (stage === "links") expect(tx.update).not.toHaveBeenCalled();
    },
  );

  it("returns 500 on transaction infrastructure failure", async () => {
    vi.mocked(db.transaction).mockRejectedValueOnce(
      new Error("database unavailable"),
    );
    expect((await apply()).status).toBe(500);
  });
});
