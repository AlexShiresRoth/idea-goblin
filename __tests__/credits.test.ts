import { db } from "@/lib/db";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockQuery } from "./helpers";

vi.mock("@/lib/db", () => ({ db: { select: vi.fn() } }));

import { creditPeriod, getCreditBalance } from "@/lib/api/credits";
import { creditCost } from "@/lib/constants";

// getCreditBalance reads the plan, then the month's usage.
function mockReads(profiles: unknown[], usage: unknown[]) {
  vi.mocked(db.select)
    .mockReturnValueOnce(mockQuery(profiles) as never)
    .mockReturnValueOnce(mockQuery(usage) as never);
}

describe("credits", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("runs from the 1st of this month to the 1st of the next, UTC", () => {
    const { start, end } = creditPeriod(new Date("2026-12-31T23:30:00Z"));

    expect(start.toISOString()).toBe("2026-12-01T00:00:00.000Z");
    expect(end.toISOString()).toBe("2027-01-01T00:00:00.000Z");
  });

  it("takes the month's charged credits off the plan's allowance", async () => {
    mockReads([{ plan: "pro" }], [{ used: "35" }]);

    const balance = await getCreditBalance(
      "user-1",
      new Date("2026-11-15T12:00:00Z"),
    );

    expect(balance).toEqual({
      plan: "pro",
      allowance: 200,
      used: 35,
      remaining: 165,
      resetsAt: "2026-12-01T00:00:00.000Z",
    });
  });

  it("treats a user without a profile or runs as free with a full allowance", async () => {
    mockReads([], [{ used: null }]);

    const balance = await getCreditBalance("user-1");

    expect(balance).toMatchObject({
      plan: "free",
      allowance: 20,
      used: 0,
      remaining: 20,
    });
  });

  it("never reports a negative balance", async () => {
    mockReads([{ plan: "free" }], [{ used: "25" }]);

    expect((await getCreditBalance("user-1")).remaining).toBe(0);
  });

  it("prices refinement by plan and gameplans the same on both", () => {
    expect(creditCost("refinement", "free")).toBe(5);
    expect(creditCost("refinement", "pro")).toBe(10);
    expect(creditCost("gameplan", "free")).toBe(5);
    expect(creditCost("gameplan", "pro")).toBe(5);
    expect(creditCost("execution", "free")).toBe(1);
  });
});
