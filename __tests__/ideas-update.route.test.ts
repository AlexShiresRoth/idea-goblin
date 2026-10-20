import { touchBuckets } from "@/lib/api/buckets";
import { AuthGuard } from "@/lib/auth/auth-guard";
import { db } from "@/lib/db";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeIdea, makeSession, mockQuery } from "./helpers";

const { embeddingsCreate } = vi.hoisted(() => ({ embeddingsCreate: vi.fn() }));

vi.mock("openai", () => ({
  default: vi.fn(function () {
    return { embeddings: { create: embeddingsCreate } };
  }),
}));
vi.mock("@/lib/auth/auth-guard", () => ({ AuthGuard: vi.fn() }));
vi.mock("@/lib/api/buckets", () => ({ touchBuckets: vi.fn() }));
vi.mock("@/lib/db", () => ({
  db: { select: vi.fn(), update: vi.fn() },
}));

import { POST } from "@/app/api/ideas/update/route";

function update(body: unknown) {
  return POST(
    new Request("http://localhost/api/ideas/update", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  );
}

describe("POST /api/ideas/update", () => {
  let updateQuery: ReturnType<typeof mockQuery>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(AuthGuard).mockResolvedValue(makeSession() as never);
    embeddingsCreate.mockResolvedValue({ data: [{ embedding: [0.2] }] });
    vi.mocked(db.select)
      .mockReturnValueOnce(mockQuery([makeIdea({ id: 7 })]) as never)
      .mockReturnValueOnce(mockQuery([{ bucketId: 10 }]) as never);
    updateQuery = mockQuery([{ id: 7, title: "New title" }]);
    vi.mocked(db.update).mockReturnValue(updateQuery as never);
  });

  it("returns 400 when the title or description is blank", async () => {
    const response = await update({ ideaId: 7, title: " ", description: "x" });

    expect(response.status).toBe(400);
    expect(db.update).not.toHaveBeenCalled();
  });

  it("returns 404 for an idea the user doesn't own", async () => {
    vi.mocked(db.select)
      .mockReset()
      .mockReturnValue(mockQuery([]) as never);

    const response = await update({
      ideaId: 7,
      title: "New title",
      description: "New description",
    });

    expect(response.status).toBe(404);
    expect(db.update).not.toHaveBeenCalled();
  });

  it("saves the trimmed text, re-embeds it, and touches its buckets", async () => {
    const response = await update({
      ideaId: 7,
      title: "  New title ",
      description: "New description ",
    });

    expect(response.status).toBe(200);
    expect(updateQuery.set).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "New title",
        description: "New description",
        embedding: [0.2],
      }),
    );
    expect(embeddingsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        input: expect.stringContaining("Title: New title"),
      }),
    );
    expect(touchBuckets).toHaveBeenCalledWith([10]);
    await expect(response.json()).resolves.toMatchObject({
      title: "New title",
    });
  });

  it("skips re-embedding when nothing changed", async () => {
    const idea = makeIdea({ id: 7 });

    await update({
      ideaId: 7,
      title: idea.title,
      description: idea.description,
    });

    expect(embeddingsCreate).not.toHaveBeenCalled();
    expect(updateQuery.set).toHaveBeenCalledWith(
      expect.not.objectContaining({ embedding: expect.anything() }),
    );
  });

  it("keeps the old embedding when re-embedding fails", async () => {
    embeddingsCreate.mockRejectedValue(new Error("rate limited"));

    const response = await update({
      ideaId: 7,
      title: "New title",
      description: "New description",
    });

    expect(response.status).toBe(200);
    expect(updateQuery.set).toHaveBeenCalledWith(
      expect.not.objectContaining({ embedding: expect.anything() }),
    );
  });
});
