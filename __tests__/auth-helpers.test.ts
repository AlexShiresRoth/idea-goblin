// @vitest-environment node
import { createServerClient } from "@/lib/auth/client";
import { db } from "@/lib/db";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockQuery } from "./helpers";

vi.mock("@/lib/auth/client", () => ({ createServerClient: vi.fn() }));
vi.mock("@/lib/db", () => ({ db: { select: vi.fn(), insert: vi.fn() } }));
vi.mock("next/navigation", () => ({
  // Next rethrows its own control-flow errors (redirects); others pass.
  unstable_rethrow: vi.fn((error: unknown) => {
    if ((error as Error).message === "NEXT_REDIRECT") throw error;
  }),
}));

import { ensureProfile, getFocusLimit } from "@/lib/api/profiles";
import { AuthGuard } from "@/lib/auth/auth-guard";
import { getSession } from "@/lib/auth/session";

function supabaseWith(user: unknown, session: unknown = { user }) {
  vi.mocked(createServerClient).mockResolvedValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user } }),
      getSession: vi.fn().mockResolvedValue({ data: { session } }),
    },
  } as never);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("AuthGuard", () => {
  it("returns the session for a signed-in user", async () => {
    supabaseWith({ id: "user-1" });

    expect(await AuthGuard()).toEqual({ user: { id: "user-1" } });
  });

  it("throws when there is no verified user", async () => {
    supabaseWith(null, { user: { id: "forged" } });

    await expect(AuthGuard()).rejects.toThrow("Unauthorized");
  });

  it("throws when the user has no session", async () => {
    supabaseWith({ id: "user-1" }, null);

    await expect(AuthGuard()).rejects.toThrow("Unauthorized");
  });
});

describe("getSession", () => {
  it("returns the verified user", async () => {
    supabaseWith({ id: "user-1" });

    expect(await getSession()).toEqual({ id: "user-1" });
  });

  it("returns null when signed out", async () => {
    supabaseWith(null);

    expect(await getSession()).toBeNull();
  });

  it("returns null when the auth call fails", async () => {
    vi.mocked(createServerClient).mockRejectedValue(new Error("network"));
    vi.spyOn(console, "error").mockImplementation(() => {});

    expect(await getSession()).toBeNull();
  });

  it("lets Next's own control-flow errors through", async () => {
    vi.mocked(createServerClient).mockRejectedValue(new Error("NEXT_REDIRECT"));

    await expect(getSession()).rejects.toThrow("NEXT_REDIRECT");
  });
});

describe("ensureProfile", () => {
  const session = {
    user: {
      id: "user-1",
      email: "goblin@example.com",
      user_metadata: { name: "Gob" },
    },
  };

  it("returns an existing profile without creating one", async () => {
    vi.mocked(db.select).mockReturnValue(
      mockQuery([{ id: "user-1", activeIdeasAmt: 2 }]) as never,
    );

    expect(await ensureProfile(session as never)).toEqual({
      id: "user-1",
      activeIdeasAmt: 2,
    });
    expect(db.insert).not.toHaveBeenCalled();
  });

  it("creates a profile on the user's first write", async () => {
    vi.mocked(db.select).mockReturnValue(mockQuery([]) as never);
    const insert = mockQuery([{ id: "user-1" }]);
    vi.mocked(db.insert).mockReturnValue(insert as never);

    expect(await ensureProfile(session as never)).toEqual({ id: "user-1" });
    expect(insert.values).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "user-1",
        name: "Gob",
        email: "goblin@example.com",
        activeIdeasAmt: 2,
      }),
    );
  });

  it("names a profile without a display name 'Goblinner'", async () => {
    vi.mocked(db.select).mockReturnValue(mockQuery([]) as never);
    const insert = mockQuery([{ id: "user-1" }]);
    vi.mocked(db.insert).mockReturnValue(insert as never);

    await ensureProfile({
      user: { ...session.user, user_metadata: {} },
    } as never);

    expect(insert.values).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Goblinner" }),
    );
  });
});

describe("getFocusLimit", () => {
  it("uses the profile's limit", async () => {
    vi.mocked(db.select).mockReturnValue(mockQuery([{ limit: 3 }]) as never);

    expect(await getFocusLimit("user-1")).toBe(3);
  });

  it("falls back to two without a profile", async () => {
    vi.mocked(db.select).mockReturnValue(mockQuery([]) as never);

    expect(await getFocusLimit("user-1")).toBe(2);
  });
});
