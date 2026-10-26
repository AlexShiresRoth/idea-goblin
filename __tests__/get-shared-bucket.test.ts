// @vitest-environment node
import { db } from "@/lib/db";
import type { SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockQuery } from "./helpers";

vi.mock("@/lib/db", () => ({ db: { select: vi.fn() } }));

import { getSharedBucket } from "@/lib/api/buckets";

const bucketRow = {
  id: 10,
  name: "Launch ideas",
  description: "Things to try",
  theme: "growth",
  category: null,
  profileId: "owner-1",
};
const idea = {
  id: 1,
  title: "Waitlist",
  description: "Emails",
  category: "product",
  status: "incubating",
  type: "idea",
};
const plan = { finish_line: "Live", phases: [] };

function whereOf(query: ReturnType<typeof mockQuery>) {
  const where = query.where as ReturnType<typeof vi.fn>;
  return new PgDialect().sqlToQuery(where.mock.calls[0][0] as SQL);
}

describe("getSharedBucket", () => {
  let queries: ReturnType<typeof mockQuery>[];

  function mockSelects(...results: unknown[]) {
    queries = results.map((result) => mockQuery(result));
    for (const query of queries) {
      vi.mocked(db.select).mockReturnValueOnce(query as never);
    }
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null without loading anything else for an unknown token", async () => {
    mockSelects([]);

    expect(await getSharedBucket("nope")).toBeNull();
    expect(db.select).toHaveBeenCalledTimes(1);
    expect(whereOf(queries[0]).params).toEqual(["nope"]);
  });

  it("returns the bucket without its owner, its ideas and latest gameplan", async () => {
    mockSelects([bucketRow], [idea], [{ data: plan }]);

    const shared = await getSharedBucket("tok");

    expect(shared).toEqual({
      bucket: {
        name: "Launch ideas",
        description: "Things to try",
        theme: "growth",
        category: null,
      },
      ideas: [idea],
      gameplan: plan,
    });
    // The owner's gameplan for this bucket, not anyone else's.
    expect(whereOf(queries[2]).params).toEqual(
      expect.arrayContaining(["owner-1", 10, "gameplan"]),
    );
  });

  it("has no gameplan when none is saved", async () => {
    mockSelects([bucketRow], [], []);

    expect((await getSharedBucket("tok"))?.gameplan).toBeNull();
  });
});
