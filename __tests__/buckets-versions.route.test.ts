import { getBucketIdeas, snapshotBucket } from "@/lib/api/buckets";
import { AuthGuard } from "@/lib/auth/auth-guard";
import { db } from "@/lib/db";
import {
  bucketVersionsTable,
  ideaBucketLinksTable,
  ideaBucketsTable,
  ideasTable,
} from "@/lib/db/schema";
import type { SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeBucket, makeSession, mockQuery } from "./helpers";

const { embeddingsCreate } = vi.hoisted(() => ({
  embeddingsCreate: vi.fn(),
}));

vi.mock("openai", () => ({
  default: vi.fn(function () {
    return {
      embeddings: {
        create: embeddingsCreate,
      },
    };
  }),
}));
vi.mock("@/lib/auth/auth-guard", () => ({ AuthGuard: vi.fn() }));
vi.mock("@/lib/api/buckets", () => ({
  getBucketIdeas: vi.fn(),
  snapshotBucket: vi.fn(),
}));
vi.mock("@/lib/db", () => ({
  db: { select: vi.fn(), update: vi.fn(), transaction: vi.fn() },
}));

import { POST as update } from "@/app/api/buckets/update/route";
import { POST as restore } from "@/app/api/buckets/versions/restore/route";

function post(handler: (request: Request) => Promise<Response>, body: unknown) {
  return handler(
    new Request("http://localhost/api", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  );
}

function makeTx(snapshotIdeas = [snapshotIdea(1, "new"), snapshotIdea(3)]) {
  const lockQuery = mockQuery([{ ...bucket, name: "Latest name" }]);
  lockQuery.for = vi.fn(() => lockQuery);
  const tx = {
    select: vi
      .fn()
      .mockReturnValueOnce(lockQuery)
      .mockReturnValueOnce(mockQuery(snapshotIdeas)),
    update: vi.fn(() => mockQuery(undefined)),
    delete: vi.fn(() => mockQuery(undefined)),
    insert: vi.fn(() => mockQuery([{ id: 50 }])),
  };
  vi.mocked(db.transaction).mockImplementation(
    async (fn: (tx: never) => Promise<unknown>) => fn(tx as never),
  );
  return { tx, lockQuery };
}

function snapshotIdea(id: number, description = "d") {
  return {
    id,
    title: `Idea ${id}`,
    description,
    category: "c",
    status: "incubating",
    type: "idea",
  };
}

const bucket = makeBucket();

describe("POST /api/buckets/update", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(AuthGuard).mockResolvedValue(makeSession() as never);
  });

  it("returns 404 when the bucket is not the user's", async () => {
    vi.mocked(db.select).mockReturnValue(mockQuery([]) as never);

    const response = await post(update, {
      bucketId: 10,
      name: "N",
      description: "D",
    });

    expect(response.status).toBe(404);
    expect(snapshotBucket).not.toHaveBeenCalled();
  });

  it("saves a version before updating the bucket", async () => {
    vi.mocked(db.select).mockReturnValue(mockQuery([bucket]) as never);
    const updated = mockQuery([{ ...bucket, name: "N" }]);
    vi.mocked(db.update).mockReturnValue(updated as never);

    const response = await post(update, {
      bucketId: 10,
      name: "N",
      description: "D",
    });

    expect(response.status).toBe(200);
    const selected = vi.mocked(db.select).mock.results[0].value;
    const { sql } = new PgDialect().sqlToQuery(
      vi.mocked(selected.where as (condition: SQL) => unknown).mock.calls[0][0],
    );
    expect(sql).toContain('"idea_buckets"."deleted_at" is null');
    expect(snapshotBucket).toHaveBeenCalledWith(bucket);
    expect(updated.set).toHaveBeenCalledWith(
      expect.objectContaining({ name: "N", description: "D" }),
    );
    const condition = vi.mocked(updated.where as (condition: SQL) => unknown)
      .mock.calls[0][0];
    expect(new PgDialect().sqlToQuery(condition).sql).toContain(
      '"idea_buckets"."deleted_at" is null',
    );
  });

  it("applies a refined category from the list", async () => {
    vi.mocked(db.select).mockReturnValue(mockQuery([bucket]) as never);
    const updated = mockQuery([bucket]);
    vi.mocked(db.update).mockReturnValue(updated as never);

    await post(update, {
      bucketId: 10,
      name: "N",
      description: "D",
      category: "sports",
    });

    expect(updated.set).toHaveBeenCalledWith(
      expect.objectContaining({ category: "sports" }),
    );
  });

  it("keeps the current category when the refined one is missing or unknown", async () => {
    vi.mocked(db.select).mockReturnValue(mockQuery([bucket]) as never);
    const updated = mockQuery([bucket]);
    vi.mocked(db.update).mockReturnValue(updated as never);

    await post(update, { bucketId: 10, name: "N", description: "D" });
    await post(update, {
      bucketId: 10,
      name: "N",
      description: "D",
      category: "skull",
    });

    for (const [values] of vi.mocked(updated.set as ReturnType<typeof vi.fn>)
      .mock.calls) {
      expect(values).not.toHaveProperty("category");
    }
  });
});

describe("POST /api/buckets/versions/restore", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    embeddingsCreate
      .mockReset()
      .mockResolvedValue({ data: [{ embedding: [0.1] }] });
    vi.mocked(AuthGuard).mockResolvedValue(makeSession() as never);
  });

  it("returns 400 when versionId is missing", async () => {
    const response = await post(restore, {});
    expect(response.status).toBe(400);
  });

  it("returns 404 when the version is not the user's", async () => {
    vi.mocked(db.select).mockReturnValue(mockQuery([]) as never);

    const response = await post(restore, { versionId: 3 });

    expect(response.status).toBe(404);
    expect(snapshotBucket).not.toHaveBeenCalled();
  });

  it("returns 404 without snapshot or idea writes when trashed during embedding", async () => {
    const version = {
      id: 3,
      ideas: [snapshotIdea(1, "old"), snapshotIdea(2)],
    };
    vi.mocked(db.select).mockReturnValue(
      mockQuery([{ version, bucket }]) as never,
    );
    vi.mocked(getBucketIdeas).mockResolvedValue([
      snapshotIdea(1, "new"),
      snapshotIdea(3),
    ]);
    const { tx, lockQuery } = makeTx();
    embeddingsCreate.mockImplementation(async () => {
      expect(db.transaction).not.toHaveBeenCalled();
      expect(snapshotBucket).not.toHaveBeenCalled();
      // Trash commits after the initial lookup, before restore takes its lock.
      vi.mocked(lockQuery.for as () => unknown).mockResolvedValue([]);
      return { data: [{ embedding: [0.1] }] };
    });

    const response = await post(restore, { versionId: 3 });

    expect(embeddingsCreate).toHaveBeenCalledTimes(2);
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "Bucket not found" });
    expect(tx.select).toHaveBeenCalledTimes(1);
    expect(tx.select.mock.results[0].value.from).toHaveBeenCalledWith(
      ideaBucketsTable,
    );
    expect(lockQuery.for).toHaveBeenCalledWith("update");
    expect(snapshotBucket).not.toHaveBeenCalled();
    expect(tx.insert).not.toHaveBeenCalled();
    expect(tx.update).not.toHaveBeenCalled();
    expect(tx.delete).not.toHaveBeenCalled();
  });

  it("waits for the live bucket lock before snapshotting or mutating ideas", async () => {
    vi.mocked(db.select).mockReturnValue(
      mockQuery([{ version: { id: 3, ideas: [] }, bucket }]) as never,
    );
    vi.mocked(getBucketIdeas).mockResolvedValue([snapshotIdea(3)]);
    const { tx, lockQuery } = makeTx();
    let releaseLock!: (rows: unknown[]) => void;
    const locked = new Promise<unknown[]>((resolve) => {
      releaseLock = resolve;
    });
    vi.mocked(lockQuery.for as () => unknown).mockReturnValue(locked);

    const pending = post(restore, { versionId: 3 });
    await vi.waitFor(() =>
      expect(lockQuery.for).toHaveBeenCalledWith("update"),
    );
    expect(snapshotBucket).not.toHaveBeenCalled();
    expect(tx.insert).not.toHaveBeenCalled();
    expect(tx.update).not.toHaveBeenCalled();
    expect(tx.delete).not.toHaveBeenCalled();
    releaseLock([]);

    expect((await pending).status).toBe(404);
    expect(tx.insert).not.toHaveBeenCalled();
    expect(tx.update).not.toHaveBeenCalled();
    expect(tx.delete).not.toHaveBeenCalled();
  });

  it("snapshots the current state, then restores the bucket and its ideas", async () => {
    const version = {
      id: 3,
      bucketId: bucket.id,
      name: "Old name",
      description: "Old description",
      theme: "old",
      category: "travel",
      ideas: [snapshotIdea(1, "old"), snapshotIdea(2)],
      createdAt: new Date(),
    };
    vi.mocked(db.select).mockReturnValue(
      mockQuery([{ version, bucket }]) as never,
    );
    // Idea 1 edited since, idea 2 deleted since, idea 3 added since.
    vi.mocked(getBucketIdeas).mockResolvedValue([
      snapshotIdea(1, "new"),
      snapshotIdea(3),
    ]);
    const { tx, lockQuery } = makeTx();

    const response = await post(restore, { versionId: 3 });

    expect(response.status).toBe(200);
    const selected = vi.mocked(db.select).mock.results[0].value;
    const { sql } = new PgDialect().sqlToQuery(
      vi.mocked(selected.where as (condition: SQL) => unknown).mock.calls[0][0],
    );
    expect(sql).toContain('"idea_buckets"."deleted_at" is null');
    expect(snapshotBucket).not.toHaveBeenCalled();
    expect(lockQuery.for).toHaveBeenCalledWith("update");
    const lockCondition = vi.mocked(
      lockQuery.where as (condition: SQL) => unknown,
    ).mock.calls[0][0];
    const lockSql = new PgDialect().sqlToQuery(lockCondition);
    expect(lockSql.sql).toContain('"idea_buckets"."deleted_at" is null');
    expect(lockSql.params).toEqual([bucket.id, "user-1"]);
    expect(tx.insert).toHaveBeenNthCalledWith(1, bucketVersionsTable);
    const snapshot = tx.insert.mock.results[0].value;
    expect(snapshot.values).toHaveBeenCalledWith({
      bucketId: bucket.id,
      name: "Latest name",
      description: bucket.description,
      theme: bucket.theme,
      category: bucket.category,
      ideas: [snapshotIdea(1, "new"), snapshotIdea(3)],
    });
    expect(
      vi.mocked(snapshot.values as () => unknown).mock.invocationCallOrder[0],
    ).toBeLessThan(tx.update.mock.invocationCallOrder[0]);
    // bucket + idea 1
    expect(tx.update).toHaveBeenCalledTimes(2);
    const bucketUpdate = tx.update.mock.results[0].value;
    expect(bucketUpdate.set).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Old name",
        theme: "old",
        category: "travel",
      }),
    );
    const condition = vi.mocked(
      bucketUpdate.where as (condition: SQL) => unknown,
    ).mock.calls[0][0];
    expect(new PgDialect().sqlToQuery(condition).sql).toContain(
      '"idea_buckets"."deleted_at" is null',
    );
    // idea 3
    expect(tx.delete).toHaveBeenCalledTimes(1);
    // Undo snapshot, idea 2 recreated, plus its bucket link.
    expect(tx.insert).toHaveBeenCalledTimes(3);
    expect(tx.insert).toHaveBeenNthCalledWith(2, ideasTable);
    expect(tx.insert).toHaveBeenNthCalledWith(3, ideaBucketLinksTable);
  });
});
