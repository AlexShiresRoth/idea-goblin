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
    parentId: null,
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

// Chainable drizzle query that resolves to `result` whenever it is awaited,
// whichever builder methods the code under test calls along the way.
export function mockQuery(result: unknown) {
  const query: Record<string, unknown> = {
    then: (
      onFulfilled: (value: unknown) => unknown,
      onRejected?: (reason: unknown) => unknown,
    ) => Promise.resolve(result).then(onFulfilled, onRejected),
  };
  for (const method of [
    "from",
    "where",
    "orderBy",
    "limit",
    "innerJoin",
    "set",
    "values",
    "returning",
  ]) {
    query[method] = vi.fn(() => query);
  }
  return query;
}

export async function readEvents(response: Response) {
  const text = await response.text();
  return text
    .split("\n")
    .filter(Boolean)
    .map(
      (line) =>
        JSON.parse(line) as {
          type: string;
          data?: unknown;
          message?: string;
          cached?: boolean;
        },
    );
}
