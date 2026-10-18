// @vitest-environment node
import { getTopLevelIdeasForProfile } from "@/lib/api/ideas";
import { AuthGuard } from "@/lib/auth/auth-guard";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeIdea, makeSession } from "./helpers";

vi.mock("@/lib/auth/auth-guard", () => ({ AuthGuard: vi.fn() }));
vi.mock("@/lib/api/ideas", () => ({ getTopLevelIdeasForProfile: vi.fn() }));

import { POST } from "@/app/api/vault/recommend/route";

describe("POST /api/vault/recommend", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(AuthGuard).mockResolvedValue(makeSession() as never);
  });

  it("returns 401 without a session", async () => {
    vi.mocked(AuthGuard).mockResolvedValue(null as never);
    const response = await POST();
    expect(response.status).toBe(401);
  });

  it("returns 400 when there are no ideas", async () => {
    vi.mocked(getTopLevelIdeasForProfile).mockResolvedValue([]);
    const response = await POST();
    expect(response.status).toBe(400);
  });

  it("picks the idea with the fewest words of description", async () => {
    vi.mocked(getTopLevelIdeasForProfile).mockResolvedValue([
      makeIdea({ id: 1, description: "a fairly detailed idea with many words" }),
      makeIdea({ id: 2, description: "vague thing" }),
      makeIdea({ id: 3, description: "somewhat less vague thing here" }),
    ]);

    const response = await POST();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ideaId).toBe(2);
    expect(body.reason).toContain("Only 2 words");
  });

  it("breaks ties by the longest untouched idea", async () => {
    vi.mocked(getTopLevelIdeasForProfile).mockResolvedValue([
      makeIdea({
        id: 1,
        description: "two words",
        updatedAt: new Date("2026-03-01T00:00:00.000Z"),
      }),
      makeIdea({
        id: 2,
        description: "two words",
        updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      }),
    ]);

    const body = await (await POST()).json();

    expect(body.ideaId).toBe(2);
    expect(body.reason).toMatch(/untouched for \d+ days/);
  });
});
