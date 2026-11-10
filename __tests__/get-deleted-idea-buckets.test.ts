// @vitest-environment node
import { db } from "@/lib/db";
import { ideaBucketsTable } from "@/lib/db/schema";
import type { SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeBucket, mockQuery, userId } from "./helpers";

vi.mock("@/lib/db", () => ({ db: { select: vi.fn() } }));

import { getDeletedIdeaBuckets } from "@/lib/api/buckets";

describe("getDeletedIdeaBuckets", () => {
  beforeEach(() => vi.resetAllMocks());

  it("loads only the owner's deleted buckets, newest deletion first", async () => {
    const buckets = [
      makeBucket({ id: 11, deletedAt: new Date("2026-11-09T00:00:00Z") }),
      makeBucket({ deletedAt: new Date("2026-11-08T00:00:00Z") }),
    ];
    const query = mockQuery(buckets);
    vi.mocked(db.select).mockReturnValue(query as never);

    expect(await getDeletedIdeaBuckets(userId)).toEqual(buckets);
    expect(query.from).toHaveBeenCalledExactlyOnceWith(ideaBucketsTable);
    const where = query.where as ReturnType<typeof vi.fn>;
    const dialect = new PgDialect();
    const predicate = dialect.sqlToQuery(where.mock.calls[0][0] as SQL);
    expect(predicate.params).toEqual([userId]);
    expect(predicate.sql).toContain('"idea_buckets"."profile_id" = $1');
    expect(predicate.sql).toContain('"idea_buckets"."deleted_at" is not null');
    const orderBy = query.orderBy as ReturnType<typeof vi.fn>;
    expect(dialect.sqlToQuery(orderBy.mock.calls[0][0] as SQL).sql)
      .toBe('"idea_buckets"."deleted_at" desc');
  });

  it("returns an empty list when Trash is empty", async () => {
    vi.mocked(db.select).mockReturnValue(mockQuery([]) as never);
    expect(await getDeletedIdeaBuckets(userId)).toEqual([]);
  });
});
