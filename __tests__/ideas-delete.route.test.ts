import { AuthGuard } from "@/lib/auth/auth-guard";
import { db } from "@/lib/db";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeIdea, makeSession, mockDelete, mockSelect } from "./helpers";

vi.mock("@/lib/auth/auth-guard", () => ({
  AuthGuard: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    select: vi.fn(),
    delete: vi.fn(),
  },
}));

import { DELETE } from "@/app/api/ideas/delete/route";

describe("DELETE /api/ideas/delete", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(AuthGuard).mockResolvedValue(makeSession() as never);
  });

  it("returns 400 when ideaId is missing", async () => {
    const response = await DELETE(
      new Request("http://localhost/api/ideas/delete", {
        method: "DELETE",
        body: JSON.stringify({}),
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Idea ID is required",
    });
  });

  it("returns 404 when the idea does not exist", async () => {
    vi.mocked(db.select).mockReturnValue(mockSelect([]) as never);

    const response = await DELETE(
      new Request("http://localhost/api/ideas/delete", {
        method: "DELETE",
        body: JSON.stringify({ ideaId: 99 }),
      }),
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: "Idea not found",
    });
  });

  it("returns 401 when the idea belongs to another user", async () => {
    vi.mocked(db.select).mockReturnValue(
      mockSelect([makeIdea({ profileId: "someone-else" })]) as never,
    );

    const response = await DELETE(
      new Request("http://localhost/api/ideas/delete", {
        method: "DELETE",
        body: JSON.stringify({ ideaId: 1 }),
      }),
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Unauthorized" });
  });

  it("deletes the idea and its bucket links", async () => {
    vi.mocked(db.select).mockReturnValue(mockSelect([makeIdea()]) as never);
    const deleted = mockDelete();
    vi.mocked(db.delete).mockReturnValue(deleted as never);

    const response = await DELETE(
      new Request("http://localhost/api/ideas/delete", {
        method: "DELETE",
        body: JSON.stringify({ ideaId: 1 }),
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      message: "Idea deleted successfully",
    });
    expect(db.delete).toHaveBeenCalledTimes(2);
    expect(deleted.where).toHaveBeenCalledTimes(2);
  });

  it("returns 500 when AuthGuard throws", async () => {
    vi.mocked(AuthGuard).mockRejectedValue(new Error("Unauthorized"));

    const response = await DELETE(
      new Request("http://localhost/api/ideas/delete", {
        method: "DELETE",
        body: JSON.stringify({ ideaId: 1 }),
      }),
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: "Failed to delete idea",
    });
  });
});
