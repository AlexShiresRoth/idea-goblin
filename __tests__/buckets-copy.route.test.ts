// @vitest-environment node
import { ensureProfile } from "@/lib/api/profiles";
import { AuthGuard } from "@/lib/auth/auth-guard";
import { db } from "@/lib/db";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeBucket, makeSession, mockQuery } from "./helpers";

vi.mock("@/lib/auth/auth-guard", () => ({ AuthGuard: vi.fn() }));
vi.mock("@/lib/api/profiles", () => ({ ensureProfile: vi.fn() }));
vi.mock("@/lib/db", () => ({
  db: { select: vi.fn(), transaction: vi.fn() },
}));

import { POST } from "@/app/api/buckets/copy/route";

function copy(body: unknown) {
  return POST(
    new Request("http://localhost/api/buckets/copy", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  );
}

const shared = makeBucket({
  id: 10,
  profileId: "owner-1",
  category: "music",
  activeSince: new Date(),
  shareToken: "tok",
});
const ideaRows = [
  {
    title: "First",
    status: "done",
    category: "product",
    type: "idea",
    description: "One",
    embedding: [0.1, 0.2],
  },
  {
    title: "Second",
    status: "incubating",
    category: "product",
    type: "idea",
    description: "Two",
    embedding: null,
  },
];

describe("POST /api/buckets/copy", () => {
  let inserts: { values: unknown }[];

  // Resets first: queued results outlive clearAllMocks when a test never
  // queries.
  function mockSelects(bucketRows: unknown[], ideas: unknown[] = ideaRows) {
    vi.mocked(db.select)
      .mockReset()
      .mockReturnValueOnce(mockQuery(bucketRows) as never)
      .mockReturnValueOnce(mockQuery(ideas) as never);
  }

  beforeEach(() => {
    vi.clearAllMocks();
    inserts = [];
    vi.mocked(AuthGuard).mockResolvedValue(makeSession("viewer-1") as never);
    vi.mocked(ensureProfile).mockResolvedValue({ id: "viewer-1" } as never);
    mockSelects([shared]);
    // Inserts return the new bucket (id 50), then new ideas (60, 61).
    const returned = [[{ id: 50 }], [{ id: 60 }, { id: 61 }], undefined];
    const tx = {
      insert: vi.fn(() => {
        const query = mockQuery(returned[inserts.length]);
        query.values = vi.fn((values: unknown) => {
          inserts.push({ values });
          return query;
        });
        return query;
      }),
    };
    vi.mocked(db.transaction).mockImplementation((async (
      run: (t: typeof tx) => unknown,
    ) => run(tx)) as never);
  });

  it("rejects signed-out requests", async () => {
    vi.mocked(AuthGuard).mockResolvedValue(null);

    const response = await copy({ token: "tok" });

    expect(response.status).toBe(401);
    expect(db.select).not.toHaveBeenCalled();
  });

  it.each([{}, { token: "" }, { token: 5 }, { token: "x".repeat(65) }])(
    "rejects an invalid body %j",
    async (body) => {
      const response = await copy(body);

      expect(response.status).toBe(400);
      expect(db.select).not.toHaveBeenCalled();
    },
  );

  it("404s for a token that isn't shared", async () => {
    mockSelects([]);

    const response = await copy({ token: "gone" });

    expect(response.status).toBe(404);
    expect(db.transaction).not.toHaveBeenCalled();
  });

  it("won't copy the viewer's own bucket", async () => {
    vi.mocked(AuthGuard).mockResolvedValue(makeSession("owner-1") as never);

    const response = await copy({ token: "tok" });

    expect(response.status).toBe(400);
    expect(db.transaction).not.toHaveBeenCalled();
  });

  it("copies the bucket and its ideas into the viewer's account", async () => {
    const response = await copy({ token: "tok" });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ bucketId: 50 });

    const [bucket, ideas, links] = inserts.map(({ values }) => values);
    // Parked and unshared, whatever the original was.
    expect(bucket).toEqual({
      name: "Launch ideas",
      description: "Things to try this month",
      theme: "growth",
      category: "music",
      profileId: "viewer-1",
    });

    const copied = ideas as (Record<string, unknown> & { createdAt: Date })[];
    expect(copied).toEqual([
      expect.objectContaining({ ...ideaRows[0], profileId: "viewer-1" }),
      expect.objectContaining({ ...ideaRows[1], profileId: "viewer-1" }),
    ]);
    // Kept in the original order.
    expect(copied[0].createdAt.getTime()).toBeLessThan(
      copied[1].createdAt.getTime(),
    );

    expect(links).toEqual([
      { ideaId: 60, bucketId: 50 },
      { ideaId: 61, bucketId: 50 },
    ]);
  });

  it("copies an empty bucket without inserting ideas", async () => {
    mockSelects([shared], []);

    const response = await copy({ token: "tok" });

    expect(await response.json()).toEqual({ bucketId: 50 });
    expect(inserts).toHaveLength(1);
  });

  it("returns 500 when the copy fails", async () => {
    vi.mocked(db.transaction).mockRejectedValue(new Error("db down"));
    vi.spyOn(console, "error").mockImplementation(() => {});

    const response = await copy({ token: "tok" });

    expect(response.status).toBe(500);
  });
});
