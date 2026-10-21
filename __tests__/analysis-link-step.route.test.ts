// @vitest-environment node
import { AuthGuard } from "@/lib/auth/auth-guard";
import { db } from "@/lib/db";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeSession, mockQuery } from "./helpers";

vi.mock("@/lib/auth/auth-guard", () => ({ AuthGuard: vi.fn() }));
vi.mock("@/lib/db", () => ({ db: { select: vi.fn(), update: vi.fn() } }));

import { POST } from "@/app/api/analysis/link-step/route";

const plan = {
  bucket_id: 10,
  bucket_name: "Launch ideas",
  finish_line: "A live page.",
  where_you_are: "Nothing yet.",
  first_step: { title: "Pick a tool", detail: "Ten minutes." },
  phases: [
    {
      title: "Build",
      goal: "Ship it",
      steps: [
        { title: "Ship page", detail: "One.", idea_id: null, effort: "low" },
      ],
    },
  ],
  cut: [],
  risks: [],
};

const step = { kind: "phase", phase: 0, step: 0 };

function link(body: unknown) {
  return POST(
    new Request("http://localhost/api/analysis/link-step", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  );
}

// The route loads the analysis, then the idea.
function found(analysis: unknown[], idea: unknown[]) {
  vi.mocked(db.select)
    .mockReturnValueOnce(mockQuery(analysis) as never)
    .mockReturnValueOnce(mockQuery(idea) as never);
}

describe("POST /api/analysis/link-step", () => {
  let updateQuery: ReturnType<typeof mockQuery>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(db.select).mockReset();
    vi.mocked(AuthGuard).mockResolvedValue(makeSession() as never);
    updateQuery = mockQuery(undefined);
    vi.mocked(db.update).mockReturnValue(updateQuery as never);
  });

  it("links the step in the saved plan and returns it", async () => {
    found([{ id: 3, analysisData: plan }], [{ id: 9 }]);

    const response = await link({ analysisId: 3, ideaId: 9, step });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.phases[0].steps[0].idea_id).toBe(9);
    expect(updateQuery.set).toHaveBeenCalledWith(
      expect.objectContaining({ analysisData: data }),
    );
  });

  it.each([
    ["no step", { analysisId: 3, ideaId: 9 }],
    ["a bad step kind", { analysisId: 3, ideaId: 9, step: { kind: "x" } }],
    [
      "a negative index",
      { analysisId: 3, ideaId: 9, step: { ...step, step: -1 } },
    ],
  ])("rejects %s", async (_label, body) => {
    expect((await link(body)).status).toBe(400);
    expect(db.update).not.toHaveBeenCalled();
  });

  it("rejects a step the plan doesn't have", async () => {
    found([{ id: 3, analysisData: plan }], [{ id: 9 }]);

    const response = await link({
      analysisId: 3,
      ideaId: 9,
      step: { kind: "phase", phase: 0, step: 5 },
    });

    expect(response.status).toBe(400);
    expect(db.update).not.toHaveBeenCalled();
  });

  it("returns 404 for another user's plan, or a non-gameplan", async () => {
    found([], [{ id: 9 }]);
    expect((await link({ analysisId: 3, ideaId: 9, step })).status).toBe(404);

    found(
      [{ id: 3, analysisData: { summary: "s", choices: [] } }],
      [{ id: 9 }],
    );
    expect((await link({ analysisId: 3, ideaId: 9, step })).status).toBe(404);
    expect(db.update).not.toHaveBeenCalled();
  });

  it("returns 404 for another user's idea", async () => {
    found([{ id: 3, analysisData: plan }], []);

    expect((await link({ analysisId: 3, ideaId: 9, step })).status).toBe(404);
    expect(db.update).not.toHaveBeenCalled();
  });
});
