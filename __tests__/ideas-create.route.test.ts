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

function create() {
  return POST(
    new Request("http://localhost/api/ideas/create", {
      method: "POST",
      body: JSON.stringify({ description: "A new idea for the vault" }),
    }),
  );
}

describe("POST /api/ideas/create", () => {
  const deleted = mockQuery(undefined);

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(AuthGuard).mockResolvedValue(makeSession() as never);
    vi.mocked(generateIdeaResponse).mockResolvedValue(
      chatJson({ title: "New", category: "app", type: "idea" }) as never,
    );
    vi.mocked(db.select)
      .mockReturnValueOnce(mockQuery([{ id: userId }]) as never)
      .mockReturnValueOnce(mockQuery([makeBucket({ id: 10 })]) as never);
    vi.mocked(db.insert).mockReturnValue(
      mockQuery([makeIdea({ id: 77 })]) as never,
    );
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
});
