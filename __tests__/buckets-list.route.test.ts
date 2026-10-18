// @vitest-environment node
import { getIdeaBuckets } from "@/lib/api/buckets";
import { AuthGuard } from "@/lib/auth/auth-guard";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeBucket, makeSession } from "./helpers";

vi.mock("@/lib/auth/auth-guard", () => ({ AuthGuard: vi.fn() }));
vi.mock("@/lib/api/buckets", () => ({ getIdeaBuckets: vi.fn() }));

import { GET } from "@/app/api/buckets/list/route";

describe("GET /api/buckets/list", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 without a session", async () => {
    vi.mocked(AuthGuard).mockResolvedValue(null as never);
    expect((await GET()).status).toBe(401);
  });

  it("returns only the fields the picker needs", async () => {
    vi.mocked(AuthGuard).mockResolvedValue(makeSession() as never);
    vi.mocked(getIdeaBuckets).mockResolvedValue([makeBucket({ id: 10 })]);

    const response = await GET();

    await expect(response.json()).resolves.toEqual([
      {
        id: 10,
        name: "Launch ideas",
        description: "Things to try this month",
        theme: "growth",
      },
    ]);
  });
});
