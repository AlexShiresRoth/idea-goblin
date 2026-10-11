import { AuthGuard } from "@/lib/auth/auth-guard";
import { db } from "@/lib/db";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeBucket, makeSession, mockDelete, mockSelect } from "./helpers";

vi.mock("@/lib/auth/auth-guard", () => ({
  AuthGuard: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    select: vi.fn(),
    delete: vi.fn(),
  },
}));

import { DELETE } from "@/app/api/buckets/delete/route";

describe("DELETE /api/buckets/delete", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(AuthGuard).mockResolvedValue(makeSession() as never);
  });

  it("returns 400 when bucketId is missing", async () => {
    const response = await DELETE(
      new Request("http://localhost/api/buckets/delete", {
        method: "DELETE",
        body: JSON.stringify({}),
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Bucket ID is required",
    });
  });

  it("returns 404 when the bucket does not exist", async () => {
    vi.mocked(db.select).mockReturnValue(mockSelect([]) as never);

    const response = await DELETE(
      new Request("http://localhost/api/buckets/delete", {
        method: "DELETE",
        body: JSON.stringify({ bucketId: 10 }),
      }),
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: "Bucket not found",
    });
  });

  it("returns 401 when the bucket belongs to another user", async () => {
    vi.mocked(db.select).mockReturnValue(
      mockSelect([makeBucket({ profileId: "someone-else" })]) as never,
    );

    const response = await DELETE(
      new Request("http://localhost/api/buckets/delete", {
        method: "DELETE",
        body: JSON.stringify({ bucketId: 10 }),
      }),
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Unauthorized" });
  });

  it("deletes linked ideas, links, and the bucket", async () => {
    const bucketSelect = mockSelect([makeBucket()]);
    const linksSelect = mockSelect([{ id: 3, ideaId: 1, bucketId: 10 }]);
    vi.mocked(db.select)
      .mockReturnValueOnce(bucketSelect as never)
      .mockReturnValueOnce(linksSelect as never);

    const deleted = mockDelete();
    vi.mocked(db.delete).mockReturnValue(deleted as never);

    const response = await DELETE(
      new Request("http://localhost/api/buckets/delete", {
        method: "DELETE",
        body: JSON.stringify({ bucketId: 10 }),
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      message: "Bucket deleted successfully",
    });
    expect(db.delete).toHaveBeenCalledTimes(3);
  });
});
