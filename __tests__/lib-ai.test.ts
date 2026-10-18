import { db } from "@/lib/db";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockQuery, userId } from "./helpers";

vi.mock("@/lib/db", () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
  },
}));

import {
  chatUsage,
  findCachedResult,
  hashInput,
  isRateLimited,
  RATE_LIMITS,
  recordRun,
  responseUsage,
} from "@/lib/ai";

describe("lib/ai", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "info").mockImplementation(() => {});
  });

  it("normalizes Responses and Chat Completions usage", () => {
    expect(
      responseUsage({
        input_tokens: 100,
        output_tokens: 50,
        output_tokens_details: { reasoning_tokens: 20 },
      } as never),
    ).toEqual({ input: 100, output: 50, reasoning: 20 });

    expect(
      chatUsage({
        prompt_tokens: 10,
        completion_tokens: 5,
        total_tokens: 15,
      }),
    ).toEqual({ input: 10, output: 5, reasoning: 0 });

    expect(responseUsage(undefined)).toEqual({
      input: 0,
      output: 0,
      reasoning: 0,
    });
  });

  it("hashes identical input identically and different input differently", () => {
    expect(hashInput("a", 1)).toBe(hashInput("a", 1));
    expect(hashInput("a", 1)).not.toBe(hashInput("a", 2));
  });

  it("is not rate limited below the limit", async () => {
    const max = RATE_LIMITS.execution!.max;
    vi.mocked(db.select).mockReturnValue(
      mockQuery([{ runs: max - 1 }]) as never,
    );

    await expect(isRateLimited(userId, "execution")).resolves.toBe(false);
  });

  it("is rate limited at the limit", async () => {
    const max = RATE_LIMITS.execution!.max;
    vi.mocked(db.select).mockReturnValue(mockQuery([{ runs: max }]) as never);

    await expect(isRateLimited(userId, "execution")).resolves.toBe(true);
  });

  it("never rate limits routes without a limit", async () => {
    await expect(isRateLimited(userId, "idea-create")).resolves.toBe(false);
    expect(db.select).not.toHaveBeenCalled();
  });

  it("returns the cached result or null", async () => {
    vi.mocked(db.select).mockReturnValue(
      mockQuery([{ result: { summary: "hi" } }]) as never,
    );
    await expect(findCachedResult(userId, "execution", "h")).resolves.toEqual({
      summary: "hi",
    });

    vi.mocked(db.select).mockReturnValue(mockQuery([]) as never);
    await expect(findCachedResult(userId, "execution", "h")).resolves.toBe(
      null,
    );
  });

  it("does not throw when recording a run fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(db.insert).mockReturnValue({
      values: vi.fn().mockRejectedValue(new Error("db down")),
    } as never);

    await expect(
      recordRun({
        profileId: userId,
        route: "execution",
        model: "m",
        usage: { input: 1, output: 1, reasoning: 0 },
      }),
    ).resolves.toBeUndefined();
  });
});
