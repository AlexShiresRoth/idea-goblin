// @vitest-environment node
import { findCachedResult, isRateLimited, recordRun } from "@/lib/ai";
import { AuthGuard } from "@/lib/auth/auth-guard";
import { getBucketIdeas } from "@/lib/api/buckets";
import { db } from "@/lib/db";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeBucket, makeSession, mockQuery, readEvents } from "./helpers";

const { stream } = vi.hoisted(() => ({ stream: vi.fn() }));

vi.mock("openai", () => ({
  OpenAI: vi.fn(function () {
    return { responses: { stream } };
  }),
}));
vi.mock("openai/helpers/zod", () => ({ zodTextFormat: vi.fn(() => ({})) }));
vi.mock("@/lib/auth/auth-guard", () => ({ AuthGuard: vi.fn() }));
vi.mock("@/lib/db", () => ({ db: { select: vi.fn() } }));
vi.mock("@/lib/api/buckets", () => ({ getBucketIdeas: vi.fn() }));
vi.mock("@/lib/ai", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/ai")>()),
  findCachedResult: vi.fn(),
  isRateLimited: vi.fn(),
  recordRun: vi.fn(),
}));

import { AI_MODELS } from "@/lib/ai";
import { POST } from "@/app/api/vault/analyze/route";

const executionResult = {
  choices: [
    {
      bucket_id: 10,
      title: "Launch",
      main_idea: "Ship it.",
      score: 80,
      feasibility: 70,
      estimated_effort: "low",
      recommendation: "pursue",
      justifications: "High value, easy.",
    },
  ],
  summary: "Do the launch.",
};

function fakeStream(output: unknown) {
  const text = JSON.stringify(output);
  return {
    async *[Symbol.asyncIterator]() {
      yield { type: "response.output_text.delta", delta: text };
    },
    finalResponse: async () => ({
      output_parsed: output,
      usage: {
        input_tokens: 100,
        output_tokens: 50,
        output_tokens_details: { reasoning_tokens: 10 },
      },
    }),
  };
}

function analyze(body: unknown) {
  return POST(
    new Request("http://localhost/api/vault/analyze", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  );
}

describe("POST /api/vault/analyze", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(AuthGuard).mockResolvedValue(makeSession() as never);
    vi.mocked(findCachedResult).mockResolvedValue(null);
    vi.mocked(isRateLimited).mockResolvedValue(false);
    vi.mocked(db.select).mockReturnValue(
      mockQuery([makeBucket({ id: 10 })]) as never,
    );
    stream.mockReturnValue(fakeStream(executionResult));
  });

  it("rejects an unknown pathway", async () => {
    const response = await analyze({ pathway: "nope" });
    expect(response.status).toBe(400);
  });

  it("runs execution on the rank model with bucket ids and capped output", async () => {
    const response = await analyze({ pathway: "execution" });
    const events = await readEvents(response);

    expect(response.status).toBe(200);
    expect(events.at(-1)).toEqual({ type: "done", data: executionResult });

    const [params] = stream.mock.calls[0];
    expect(params.model).toBe(AI_MODELS.rank);
    expect(params.reasoning).toEqual({ effort: "low" });
    expect(params.max_output_tokens).toBeGreaterThan(0);
    expect(params.input[1].content).toContain("bucket_id 10 | Launch ideas");

    expect(recordRun).toHaveBeenCalledWith(
      expect.objectContaining({
        route: "execution",
        usage: { input: 100, output: 50, reasoning: 10 },
        result: executionResult,
      }),
    );
  });

  it("streams progress steps before the result", async () => {
    const events = await readEvents(await analyze({ pathway: "execution" }));

    expect(
      events
        .filter((event) => event.type === "status")
        .map((event) => [event.step, event.message]),
    ).toEqual([
      ["context", "Read your 1 most recent bucket"],
      ["thinking", "Goblin is thinking it over"],
      ["writing", "Writing results"],
      ["writing", "1 of 1 buckets scored"],
      ["saving", "Saving the run"],
    ]);
    expect(events.at(-1)?.type).toBe("done");
  });

  it("serves a cached result without calling the model", async () => {
    vi.mocked(findCachedResult).mockResolvedValue(executionResult);

    const events = await readEvents(await analyze({ pathway: "execution" }));

    expect(events).toEqual([
      {
        type: "status",
        step: "context",
        message: "Read your 1 most recent bucket",
      },
      {
        type: "status",
        step: "cached",
        message: "Nothing changed since your last run",
      },
      { type: "done", data: executionResult, cached: true },
    ]);
    expect(stream).not.toHaveBeenCalled();
    expect(isRateLimited).not.toHaveBeenCalled();
  });

  it("returns 429 when rate limited", async () => {
    vi.mocked(isRateLimited).mockResolvedValue(true);

    const response = await analyze({ pathway: "execution" });

    expect(response.status).toBe(429);
    expect(await response.text()).toContain("runs per");
    expect(stream).not.toHaveBeenCalled();
  });

  it("returns 400 when the vault has no buckets", async () => {
    vi.mocked(db.select).mockReturnValue(mockQuery([]) as never);
    const response = await analyze({ pathway: "execution" });
    expect(response.status).toBe(400);
  });

  it("refines a bucket on the refine model, with its ideas as context", async () => {
    vi.mocked(db.select).mockReturnValue(
      mockQuery([makeBucket({ id: 5 })]) as never,
    );
    vi.mocked(getBucketIdeas).mockResolvedValue([
      {
        id: 1,
        title: "Waitlist",
        description: "Collect emails first",
        category: "c",
        status: "incubating",
        type: "idea",
      },
    ]);

    await readEvents(await analyze({ pathway: "refinement", bucketId: 5 }));

    const [params] = stream.mock.calls[0];
    expect(params.model).toBe(AI_MODELS.refine);
    expect(params.reasoning).toBeUndefined();
    expect(params.max_output_tokens).toBeUndefined();
    expect(params.input[1].content).toContain("bucket_id: 5");
    expect(params.input[1].content).toContain(
      "- Waitlist: Collect emails first",
    );
  });

  it("steers refinement by known directions and a capped note", async () => {
    vi.mocked(db.select).mockReturnValue(
      mockQuery([makeBucket({ id: 5 })]) as never,
    );
    vi.mocked(getBucketIdeas).mockResolvedValue([]);

    await readEvents(
      await analyze({
        pathway: "refinement",
        bucketId: 5,
        focus: ["marketable", "not-a-focus"],
        note: "x".repeat(400),
      }),
    );

    const content: string = stream.mock.calls[0][0].input[1].content;
    expect(content).toContain("Make it more marketable");
    expect(content).not.toContain("not-a-focus");
    expect(content).toContain(`note from the user: ${"x".repeat(300)}`);
    expect(content).not.toContain("x".repeat(301));
  });

  it("returns 400 when refining without a bucket", async () => {
    const response = await analyze({ pathway: "refinement" });
    expect(response.status).toBe(400);
  });

  it("returns 404 when refining another user's bucket", async () => {
    vi.mocked(db.select).mockReturnValue(mockQuery([]) as never);
    const response = await analyze({ pathway: "refinement", bucketId: 5 });
    expect(response.status).toBe(404);
  });
});
