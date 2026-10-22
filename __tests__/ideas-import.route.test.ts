// @vitest-environment node
import { isRateLimited, recordRun } from "@/lib/ai";
import { touchBuckets } from "@/lib/api/buckets";
import { AuthGuard } from "@/lib/auth/auth-guard";
import { db } from "@/lib/db";
import {
  ideaBucketLinksTable,
  ideaBucketsTable,
  ideasTable,
} from "@/lib/db/schema";
import {
  describeBuckets,
  describeIdeas,
  sortIdeasIntoBuckets,
} from "@/lib/prompts/import";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeBucket, makeSession, mockQuery, readEvents } from "./helpers";

const { embeddingsCreate } = vi.hoisted(() => ({
  embeddingsCreate: vi.fn(),
}));

vi.mock("openai", () => ({
  default: vi.fn(function () {
    return { embeddings: { create: embeddingsCreate } };
  }),
}));
vi.mock("@/lib/auth/auth-guard", () => ({ AuthGuard: vi.fn() }));
vi.mock("@/lib/db", () => ({
  db: { select: vi.fn(), transaction: vi.fn() },
}));
vi.mock("@/lib/api/profiles", () => ({
  ensureProfile: vi.fn(async () => ({ id: "user-1", activeIdeasAmt: 2 })),
}));
vi.mock("@/lib/api/buckets", () => ({ touchBuckets: vi.fn() }));
vi.mock("@/lib/prompts/import", () => ({
  describeBuckets: vi.fn(),
  describeIdeas: vi.fn(),
  sortIdeasIntoBuckets: vi.fn(),
}));
vi.mock("@/lib/ai", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/ai")>()),
  isRateLimited: vi.fn(),
  recordRun: vi.fn(),
}));

import { POST } from "@/app/api/ideas/import/route";

const usage = {
  input_tokens: 10,
  output_tokens: 5,
  output_tokens_details: { reasoning_tokens: 1 },
};

type Insert = { table: unknown; values: Record<string, unknown> | unknown[] };
let inserts: Insert[] = [];

// A transaction whose inserts are recorded and get increasing ids.
function mockTransaction() {
  let nextId = 100;
  const tx = {
    insert: vi.fn((table: unknown) => {
      const entry: Insert = { table, values: {} };
      const query = {
        values: vi.fn((values: Insert["values"]) => {
          entry.values = values;
          inserts.push(entry);
          return query;
        }),
        returning: vi.fn(async () => [{ id: nextId++, ...entry.values }]),
        then: (resolve: (value: unknown) => unknown) =>
          Promise.resolve(undefined).then(resolve),
      };
      return query;
    }),
  };
  vi.mocked(db.transaction).mockImplementation((async (
    run: (t: typeof tx) => unknown,
  ) => run(tx)) as never);
}

const ofTable = (table: unknown) =>
  inserts.filter((entry) => entry.table === table).map((entry) => entry.values);

function describeAll() {
  vi.mocked(describeIdeas).mockImplementation((async (
    _client: unknown,
    batch: { index: number; title?: string; description: string }[],
  ) => ({
    usage,
    output_parsed: {
      ideas: batch.map((idea) => ({
        index: idea.index,
        title: idea.title ?? `Named ${idea.index}`,
        category: "product",
        type: "idea",
        bucketCategory: "tools",
      })),
    },
  })) as never);
}

// Nearest existing idea for every duplicate lookup.
function nearest(distance: number | null) {
  vi.mocked(db.select).mockReturnValue(
    mockQuery(
      distance === null ? [] : [{ id: 7, title: "Old idea", distance }],
    ) as never,
  );
}

function importRows(body: unknown) {
  return POST(
    new Request("http://localhost/api/ideas/import", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  );
}

const row = (description: string, target: unknown, title?: string) => ({
  description,
  target,
  ...(title && { title }),
});

describe("POST /api/ideas/import", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    inserts = [];
    vi.mocked(AuthGuard).mockResolvedValue(makeSession() as never);
    vi.mocked(isRateLimited).mockResolvedValue(false);
    vi.mocked(db.select).mockReset();
    vi.mocked(db.select).mockReturnValueOnce(
      mockQuery([
        makeBucket({ id: 10, name: "Launch ideas" }),
        makeBucket({ id: 11, name: "Games" }),
      ]) as never,
    );
    nearest(null);
    embeddingsCreate.mockImplementation(async ({ input }) => ({
      data: input.map((_: string, index: number) => ({
        index,
        embedding: [index],
      })),
    }));
    describeAll();
    vi.mocked(describeBuckets).mockResolvedValue({
      usage,
      output_parsed: { buckets: [] },
    } as never);
    mockTransaction();
  });

  it.each([
    ["no rows", { rows: [] }],
    ["a short description", { rows: [row("hi", { type: "auto" })] }],
    [
      "too many rows",
      {
        rows: Array.from({ length: 101 }, () =>
          row("A fine idea", { type: "auto" }),
        ),
      },
    ],
  ])("rejects %s", async (_label, body) => {
    const response = await importRows(body);
    expect(response.status).toBe(400);
    expect(describeIdeas).not.toHaveBeenCalled();
  });

  it("rejects a bucket the user doesn't own", async () => {
    const response = await importRows({
      rows: [row("A fine idea", { type: "existing", bucketId: 99 })],
    });
    expect(response.status).toBe(400);
    expect(describeIdeas).not.toHaveBeenCalled();
  });

  it("returns 429 when rate limited", async () => {
    vi.mocked(isRateLimited).mockResolvedValue(true);
    const response = await importRows({
      rows: [row("A fine idea", { type: "auto" })],
    });
    expect(response.status).toBe(429);
    expect(await response.text()).toContain("imports per");
  });

  it("imports into an existing bucket, keeping given titles", async () => {
    const events = await readEvents(
      await importRows({
        rows: [
          row("A fine idea", { type: "existing", bucketId: 10 }, "My title"),
          row("Another idea", { type: "existing", bucketId: 10 }),
        ],
      }),
    );

    expect(ofTable(ideasTable)).toEqual([
      expect.objectContaining({
        title: "My title",
        description: "A fine idea",
        category: "product",
        embedding: [0],
        profileId: "user-1",
      }),
      expect.objectContaining({ title: "Named 1", embedding: [1] }),
    ]);
    expect(ofTable(ideaBucketLinksTable)).toEqual([
      [
        { ideaId: 100, bucketId: 10 },
        { ideaId: 101, bucketId: 10 },
      ],
    ]);
    expect(ofTable(ideaBucketsTable)).toEqual([]);
    expect(touchBuckets).toHaveBeenCalledWith([10]);
    expect(sortIdeasIntoBuckets).not.toHaveBeenCalled();
    expect(events.at(-1)).toEqual({
      type: "done",
      data: {
        created: 2,
        buckets: [{ id: 10, name: "Launch ideas", created: false, count: 2 }],
        skipped: [],
      },
    });
  });

  it("records one run per import with the summed usage", async () => {
    await readEvents(
      await importRows({
        rows: Array.from({ length: 30 }, (_, i) =>
          row(`Idea number ${i}`, { type: "existing", bucketId: 10 }),
        ),
      }),
    );

    expect(describeIdeas).toHaveBeenCalledTimes(2);
    expect(embeddingsCreate).toHaveBeenCalledTimes(1);
    expect(recordRun).toHaveBeenCalledTimes(1);
    expect(recordRun).toHaveBeenCalledWith(
      expect.objectContaining({
        route: "idea-import",
        usage: { input: 20, output: 10, reasoning: 2 },
      }),
    );
  });

  it("matches named buckets to existing ones and creates the rest once", async () => {
    const events = await readEvents(
      await importRows({
        rows: [
          row("A dungeon crawler", { type: "named", name: "  games " }),
          row("A synth app", { type: "named", name: "Music" }),
          row("A drum app", { type: "named", name: "music" }),
        ],
      }),
    );

    expect(ofTable(ideaBucketsTable)).toEqual([
      expect.objectContaining({
        name: "Music",
        description: "A synth app",
        theme: "product",
        category: "tools",
      }),
    ]);
    const links = ofTable(ideaBucketLinksTable)[0];
    expect(links).toEqual([
      { ideaId: 101, bucketId: 11 },
      { ideaId: 102, bucketId: 100 },
      { ideaId: 103, bucketId: 100 },
    ]);
    const done = events.at(-1)?.data as { buckets: unknown[] };
    expect(done.buckets).toEqual(
      expect.arrayContaining([
        { id: 100, name: "Music", created: true, count: 2 },
        { id: 11, name: "Games", created: false, count: 1 },
      ]),
    );
  });

  it("describes a new named bucket from all of its ideas", async () => {
    vi.mocked(describeBuckets).mockResolvedValue({
      usage,
      output_parsed: {
        buckets: [
          {
            key: "named:side quests",
            description: "A grab bag of side projects.",
            theme: "Projects",
            category: "tools",
          },
        ],
      },
    } as never);

    await readEvents(
      await importRows({
        rows: [
          row("A smart dog bowl", { type: "named", name: "Side quests" }),
          row("A tax tracker", { type: "named", name: "Side quests" }),
          row("A lone synth app", { type: "named", name: "Solo" }),
        ],
      }),
    );

    // Only buckets with several ideas need a summary.
    expect(describeBuckets).toHaveBeenCalledTimes(1);
    expect(vi.mocked(describeBuckets).mock.calls[0][1]).toEqual([
      {
        key: "named:side quests",
        name: "Side quests",
        ideas: [
          { title: "Named 0", description: "A smart dog bowl" },
          { title: "Named 1", description: "A tax tracker" },
        ],
      },
    ]);
    expect(ofTable(ideaBucketsTable)).toEqual([
      expect.objectContaining({
        name: "Side quests",
        description: "A grab bag of side projects.",
        theme: "Projects",
      }),
      expect.objectContaining({
        name: "Solo",
        description: "A lone synth app",
      }),
    ]);
  });

  it("keeps the user's description for a new bucket", async () => {
    await readEvents(
      await importRows({
        rows: [
          row("A smart dog bowl", {
            type: "named",
            name: "Side quests",
            description: "Things to tinker with",
          }),
          row("A tax tracker", { type: "named", name: "Side quests" }),
        ],
      }),
    );

    expect(describeBuckets).not.toHaveBeenCalled();
    expect(ofTable(ideaBucketsTable)).toEqual([
      expect.objectContaining({
        name: "Side quests",
        description: "Things to tinker with",
      }),
    ]);
  });

  it("starts a new user's first buckets as worked on, up to the limit", async () => {
    vi.mocked(db.select)
      .mockReset()
      .mockReturnValueOnce(mockQuery([]) as never);
    nearest(null);

    await readEvents(
      await importRows({
        rows: [
          row("A dungeon crawler", { type: "named", name: "Games" }),
          row("A synth app", { type: "named", name: "Music" }),
          row("A tax tracker", { type: "named", name: "Money" }),
        ],
      }),
    );

    expect(
      ofTable(ideaBucketsTable).map((bucket) => [
        (bucket as { name: string }).name,
        (bucket as { activeSince: Date | null }).activeSince instanceof Date,
      ]),
    ).toEqual([
      ["Games", true],
      ["Music", true],
      ["Money", false],
    ]);
  });

  it("starts new buckets parked once anything is parked", async () => {
    await readEvents(
      await importRows({
        rows: [row("A synth app", { type: "named", name: "Music" })],
      }),
    );

    expect(ofTable(ideaBucketsTable)).toEqual([
      expect.objectContaining({ name: "Music", activeSince: null }),
    ]);
  });

  it("sorts auto ideas in one call, sharing new buckets and falling back", async () => {
    vi.mocked(sortIdeasIntoBuckets).mockResolvedValue({
      usage,
      output_parsed: {
        assignments: [
          { index: 0, bucketId: 11, newBucketKey: null },
          { index: 1, bucketId: null, newBucketKey: "pets" },
          { index: 2, bucketId: null, newBucketKey: "pets" },
          { index: 3, bucketId: 999, newBucketKey: null },
        ],
        newBuckets: [
          {
            key: "pets",
            name: "Pet tech",
            description: "Gadgets for pets",
            theme: "Product",
            category: "tools",
          },
        ],
      },
    } as never);

    await readEvents(
      await importRows({
        rows: [
          row("A dungeon crawler", { type: "auto" }),
          row("A smart dog bowl", { type: "auto" }),
          row("A cat GPS collar", { type: "auto" }),
          row("Something odd", { type: "auto" }),
        ],
      }),
    );

    expect(sortIdeasIntoBuckets).toHaveBeenCalledTimes(1);
    expect(ofTable(ideaBucketsTable)).toEqual([
      expect.objectContaining({ name: "Pet tech" }),
      expect.objectContaining({ name: "Imported ideas" }),
    ]);
    expect(ofTable(ideaBucketLinksTable)[0]).toEqual([
      { ideaId: 102, bucketId: 11 },
      { ideaId: 103, bucketId: 100 },
      { ideaId: 104, bucketId: 100 },
      { ideaId: 105, bucketId: 101 },
    ]);
  });

  it("skips ideas that look like ones already in the vault", async () => {
    nearest(0.03);

    const events = await readEvents(
      await importRows({
        rows: [row("A fine idea", { type: "existing", bucketId: 10 })],
      }),
    );

    expect(db.transaction).not.toHaveBeenCalled();
    expect(events.at(-1)).toEqual({
      type: "done",
      data: {
        created: 0,
        buckets: [],
        skipped: [
          {
            row: {
              description: "A fine idea",
              target: { type: "existing", bucketId: 10 },
            },
            duplicateOf: { id: 7, title: "Old idea" },
          },
        ],
      },
    });
  });

  it("keeps lookalikes when importing anyway", async () => {
    nearest(0.03);

    await readEvents(
      await importRows({
        rows: [row("A fine idea", { type: "existing", bucketId: 10 })],
        allowDuplicates: true,
      }),
    );

    // Only the bucket lookup; no duplicate checks.
    expect(db.select).toHaveBeenCalledTimes(1);
    expect(ofTable(ideasTable)).toHaveLength(1);
  });

  it("saves nothing when a model call fails", async () => {
    embeddingsCreate.mockRejectedValue(new Error("boom"));

    const events = await readEvents(
      await importRows({ rows: [row("A fine idea", { type: "auto" })] }),
    );

    expect(events.at(-1)).toEqual({
      type: "error",
      message: "The goblin dropped your import. Nothing was saved.",
    });
    expect(db.transaction).not.toHaveBeenCalled();
    // The naming call still spent tokens, so the import still counts.
    expect(recordRun).toHaveBeenCalledTimes(1);
  });
});
