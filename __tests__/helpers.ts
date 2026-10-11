import { IdeaBucket, IdeaView } from "@/lib/db/schema";
import { vi } from "vitest";

export const userId = "user-1";

export function makeSession(id = userId) {
  return {
    user: { id },
  };
}

export function makeIdea(overrides: Partial<IdeaView> = {}): IdeaView {
  return {
    id: 1,
    title: "Ship a landing page",
    status: "incubating",
    profileId: userId,
    category: "product",
    type: "idea",
    description: "A simple page to collect emails.",
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  };
}

export function makeBucket(overrides: Partial<IdeaBucket> = {}): IdeaBucket {
  return {
    id: 10,
    name: "Launch ideas",
    description: "Things to try this month",
    theme: "growth",
    profileId: userId,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  };
}

export function mockSelect(result: unknown) {
  const limit = vi.fn().mockResolvedValue(result);
  const where = vi.fn().mockReturnValue({
    limit,
    then: (onFulfilled: (value: unknown) => unknown) =>
      Promise.resolve(result).then(onFulfilled),
  });
  const innerJoin = vi.fn().mockReturnValue({ where });
  const from = vi.fn().mockReturnValue({ where, innerJoin });

  return { from, where, innerJoin, limit };
}

export function mockDelete() {
  const where = vi.fn().mockResolvedValue(undefined);
  const from = vi.fn().mockReturnValue({ where });
  return { from, where };
}
