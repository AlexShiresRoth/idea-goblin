// @vitest-environment node
import { getBucketVersions } from "@/lib/api/buckets";
import { getTopLevelIdeasForProfile } from "@/lib/api/ideas";
import { AuthGuard } from "@/lib/auth/auth-guard";
import { db } from "@/lib/db";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeIdea, makeSession, mockQuery } from "./helpers";

vi.mock("@/lib/auth/auth-guard", () => ({ AuthGuard: vi.fn() }));
vi.mock("@/lib/db", () => ({ db: { select: vi.fn(), delete: vi.fn() } }));
vi.mock("@/lib/api/buckets", () => ({ getBucketVersions: vi.fn() }));
vi.mock("@/lib/api/ideas", () => ({ getTopLevelIdeasForProfile: vi.fn() }));

import { DELETE as deleteAnalysis } from "@/app/api/analysis/delete/route";
import { GET as listVersions } from "@/app/api/buckets/versions/route";
import { GET as listIdeas } from "@/app/api/ideas/list/route";

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(AuthGuard).mockResolvedValue(makeSession() as never);
});

describe("DELETE /api/analysis/delete", () => {
  const remove = (body: unknown) =>
    deleteAnalysis(
      new Request("http://localhost/api/analysis/delete", {
        method: "DELETE",
        body: JSON.stringify(body),
      }),
    );

  let deleted: ReturnType<typeof mockQuery>;

  beforeEach(() => {
    deleted = mockQuery(undefined);
    vi.mocked(db.delete).mockReturnValue(deleted as never);
  });

  it("deletes the user's own analysis", async () => {
    vi.mocked(db.select).mockReturnValue(
      mockQuery([{ id: 3, profileId: "user-1" }]) as never,
    );

    const response = await remove({ analysisId: 3 });

    expect(response.status).toBe(200);
    expect(db.delete).toHaveBeenCalledTimes(1);
  });

  it("refuses to delete another user's analysis", async () => {
    vi.mocked(db.select).mockReturnValue(
      mockQuery([{ id: 3, profileId: "someone-else" }]) as never,
    );

    const response = await remove({ analysisId: 3 });

    expect(response.status).toBe(401);
    expect(db.delete).not.toHaveBeenCalled();
  });

  it("returns 404 for a missing analysis", async () => {
    vi.mocked(db.select).mockReturnValue(mockQuery([]) as never);

    expect((await remove({ analysisId: 3 })).status).toBe(404);
    expect(db.delete).not.toHaveBeenCalled();
  });

  it("needs an analysis id", async () => {
    expect((await remove({})).status).toBe(400);
    expect(db.select).not.toHaveBeenCalled();
  });

  it("returns 500 when the database fails", async () => {
    vi.mocked(db.select).mockImplementation(() => {
      throw new Error("down");
    });
    vi.spyOn(console, "error").mockImplementation(() => {});

    expect((await remove({ analysisId: 3 })).status).toBe(500);
  });
});

describe("GET /api/buckets/versions", () => {
  const list = (query: string) =>
    listVersions(new Request(`http://localhost/api/buckets/versions${query}`));

  it("lists versions of the user's own bucket", async () => {
    const query = mockQuery([{ id: 10 }]);
    vi.mocked(db.select).mockReturnValue(query as never);
    vi.mocked(getBucketVersions).mockResolvedValue([{ id: 1 }] as never);

    const response = await list("?bucketId=10");

    expect(await response.json()).toEqual([{ id: 1 }]);
    expect(getBucketVersions).toHaveBeenCalledWith(10);
    expect(query.where).toHaveBeenCalled();
  });

  it("returns 404 for another user's bucket without loading versions", async () => {
    vi.mocked(db.select).mockReturnValue(mockQuery([]) as never);

    expect((await list("?bucketId=10")).status).toBe(404);
    expect(getBucketVersions).not.toHaveBeenCalled();
  });

  it.each(["", "?bucketId=abc", "?bucketId=0"])(
    "needs a bucket id (%s)",
    async (query) => {
      expect((await list(query)).status).toBe(400);
      expect(db.select).not.toHaveBeenCalled();
    },
  );
});

describe("GET /api/ideas/list", () => {
  it("lists only the signed-in user's ideas", async () => {
    vi.mocked(getTopLevelIdeasForProfile).mockResolvedValue([
      makeIdea(),
    ] as never);

    const response = await listIdeas();

    expect(getTopLevelIdeasForProfile).toHaveBeenCalledWith("user-1");
    expect(await response.json()).toHaveLength(1);
  });

  it("returns 500 when loading fails", async () => {
    vi.mocked(getTopLevelIdeasForProfile).mockRejectedValue(new Error("down"));
    vi.spyOn(console, "error").mockImplementation(() => {});

    expect((await listIdeas()).status).toBe(500);
  });
});
