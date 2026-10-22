import { activeSlotsForNewBuckets } from "@/lib/focus";
import { describe, expect, it } from "vitest";

const active = { activeSince: new Date() };
const parked = { activeSince: null };

describe("activeSlotsForNewBuckets", () => {
  it("fills a new user's focus up to the limit", () => {
    expect(activeSlotsForNewBuckets([], 2)).toBe(2);
    expect(activeSlotsForNewBuckets([active], 2)).toBe(1);
    expect(activeSlotsForNewBuckets([active, active], 2)).toBe(0);
  });

  it("starts new buckets parked once anything is parked", () => {
    expect(activeSlotsForNewBuckets([parked], 2)).toBe(0);
    expect(activeSlotsForNewBuckets([active, parked], 3)).toBe(0);
  });
});
