import { getBucketIdeas, snapshotBucket } from "@/lib/api/buckets";
import { AuthGuard } from "@/lib/auth/auth-guard";
import { db } from "@/lib/db";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeBucket, makeSession, mockQuery } from "./helpers";

vi.mock("openai", () => ({
  default: vi.fn(function () {
    return {
      embeddings: {
        create: vi.fn().mockResolvedValue({ data: [{ embedding: [0.1] }] }),
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

function makeTx() {
  const tx = {
    update: vi.fn(() => mockQuery(undefined)),
    delete: vi.fn(() => mockQuery(undefined)),
    insert: vi.fn(() => mockQuery([{ id: 50 }])),
  };
  vi.mocked(db.transaction).mockImplementation(
    async (fn: (tx: never) => Promise<unknown>) => fn(tx as never),
  );
  return tx;
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
    expect(snapshotBucket).toHaveBeenCalledWith(bucket);
    expect(updated.set).toHaveBeenCalledWith(
      expect.objectContaining({ name: "N", description: "D" }),
    );
  });
});

describe("POST /api/buckets/versions/restore", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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

  it("snapshots the current state, then restores the bucket and its ideas", async () => {
    const version = {
      id: 3,
      bucketId: bucket.id,
      name: "Old name",
      description: "Old description",
      theme: "old",
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
    const tx = makeTx();

    const response = await post(restore, { versionId: 3 });

    expect(response.status).toBe(200);
    expect(snapshotBucket).toHaveBeenCalledWith(bucket);
    // bucket + idea 1
    expect(tx.update).toHaveBeenCalledTimes(2);
    // idea 3
    expect(tx.delete).toHaveBeenCalledTimes(1);
    // idea 2 recreated, plus its bucket link
    expect(tx.insert).toHaveBeenCalledTimes(2);
  });
});
