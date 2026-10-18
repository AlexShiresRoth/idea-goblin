// @vitest-environment node
import { touchBuckets } from "@/lib/api/buckets";
import { AuthGuard } from "@/lib/auth/auth-guard";
import { db } from "@/lib/db";
import { findRelevantBucket, generateIdeaResponse } from "@/lib/prompts";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  makeBucket,
  makeIdea,
  makeSession,
  mockQuery,
  userId,
} from "./helpers";

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
vi.mock("@/lib/db", () => ({
  db: { select: vi.fn(), insert: vi.fn(), delete: vi.fn() },
}));
vi.mock("@/lib/prompts", () => ({
  generateIdeaResponse: vi.fn(),
  findRelevantBucket: vi.fn(),
}));
vi.mock("@/lib/api/buckets", () => ({ touchBuckets: vi.fn() }));
vi.mock("@/lib/ai", () => ({
  AI_MODELS: { rank: "mini" },
  chatUsage: vi.fn(() => ({ input: 0, output: 0, reasoning: 0 })),
  recordRun: vi.fn(),
}));

import { POST } from "@/app/api/ideas/create/route";

function chatJson(content: unknown) {
  return { choices: [{ message: { content: JSON.stringify(content) } }] };
}

function classifyAs(bucketId: number) {
  vi.mocked(findRelevantBucket).mockResolvedValue(
    chatJson({
      action: "use_existing",
      bucketId,
      relevanceScore: 90,
      newBucketName: null,
      newBucketDescription: null,
      newBucketTheme: null,
      reasoning: "fits",
    }) as never,
  );
}

function create(options: Record<string, unknown> = {}) {
  return POST(
    new Request("http://localhost/api/ideas/create", {
      method: "POST",
      body: JSON.stringify({
        description: "A new idea for the vault",
        ...options,
      }),
    }),
  );
}

describe("POST /api/ideas/create", () => {
  const deleted = mockQuery(undefined);
  let inserted: ReturnType<typeof mockQuery>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(AuthGuard).mockResolvedValue(makeSession() as never);
    vi.mocked(generateIdeaResponse).mockResolvedValue(
      chatJson({ title: "New", category: "app", type: "idea" }) as never,
    );
    vi.mocked(db.select)
      .mockReturnValueOnce(mockQuery([{ id: userId }]) as never)
      .mockReturnValueOnce(mockQuery([makeBucket({ id: 10 })]) as never);
    inserted = mockQuery([makeIdea({ id: 77 })]);
    vi.mocked(db.insert).mockReturnValue(inserted as never);
    vi.mocked(db.delete).mockReturnValue(deleted as never);
  });

  it("links the idea to the existing bucket and touches it", async () => {
    classifyAs(10);

    const response = await create();

    expect(response.status).toBe(200);
    expect(touchBuckets).toHaveBeenCalledWith([10]);
    expect(db.delete).not.toHaveBeenCalled();
  });

  it("rejects a bucket id outside the user's vault and removes the idea", async () => {
    classifyAs(999);

    const response = await create();

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Invalid bucket response",
    });
    expect(db.delete).toHaveBeenCalledTimes(1);
    expect(touchBuckets).not.toHaveBeenCalled();
  });

  it("adds to a chosen bucket without calling the classifier", async () => {
    const response = await create({ bucket: 10 });

    expect(response.status).toBe(200);
    expect(findRelevantBucket).not.toHaveBeenCalled();
    expect(touchBuckets).toHaveBeenCalledWith([10]);
  });

  it("rejects a chosen bucket outside the user's vault before any model call", async () => {
    const response = await create({ bucket: 999 });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Bucket not found",
    });
    expect(generateIdeaResponse).not.toHaveBeenCalled();
    expect(db.insert).not.toHaveBeenCalled();
  });

  it("creates a named bucket without calling the classifier", async () => {
    const response = await create({ bucket: "new", bucketName: "  Side quests " });

    expect(response.status).toBe(200);
    expect(findRelevantBucket).not.toHaveBeenCalled();
    const values = vi.mocked(inserted.values as ReturnType<typeof vi.fn>).mock
      .calls;
    expect(values).toContainEqual([
      expect.objectContaining({
        name: "Side quests",
        description: "A new idea for the vault",
        theme: "app",
      }),
    ]);
  });

  it("names a new bucket after the idea when no name is given", async () => {
    await create({ bucket: "new" });

    const values = vi.mocked(inserted.values as ReturnType<typeof vi.fn>).mock
      .calls;
    expect(values).toContainEqual([expect.objectContaining({ name: "New" })]);
  });

  it("rejects an overly long bucket name", async () => {
    const response = await create({ bucket: "new", bucketName: "x".repeat(101) });

    expect(response.status).toBe(400);
    expect(generateIdeaResponse).not.toHaveBeenCalled();
  });
});
