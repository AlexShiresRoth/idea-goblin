// @vitest-environment node
import { getIdeaBuckets } from "@/lib/api/buckets";
import { AuthGuard } from "@/lib/auth/auth-guard";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeBucket, makeSession } from "./helpers";

vi.mock("@/lib/auth/auth-guard", () => ({ AuthGuard: vi.fn() }));
vi.mock("@/lib/api/buckets", () => ({ getIdeaBuckets: vi.fn() }));

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

  it("returns 400 when there are no buckets", async () => {
    vi.mocked(getIdeaBuckets).mockResolvedValue([]);
    const response = await POST();
    expect(response.status).toBe(400);
  });

  it("picks the bucket with the fewest words of description", async () => {
    vi.mocked(getIdeaBuckets).mockResolvedValue([
      makeBucket({ id: 1, description: "a fairly detailed idea with many words" }),
      makeBucket({ id: 2, description: "vague thing" }),
      makeBucket({ id: 3, description: "somewhat less vague thing here" }),
    ]);

    const response = await POST();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.bucketId).toBe(2);
    expect(body.reason).toContain("Only 2 words");
  });

  it("breaks ties by the longest untouched bucket", async () => {
    vi.mocked(getIdeaBuckets).mockResolvedValue([
      makeBucket({
        id: 1,
        description: "two words",
        updatedAt: new Date("2026-03-01T00:00:00.000Z"),
      }),
      makeBucket({
        id: 2,
        description: "two words",
        updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      }),
    ]);

    const body = await (await POST()).json();

    expect(body.bucketId).toBe(2);
    expect(body.reason).toMatch(/untouched for \d+ days/);
  });
});
