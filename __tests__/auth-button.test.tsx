import AuthButton from "@/app/components/auth-button";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { auth } = vi.hoisted(() => ({
  auth: { signInWithOAuth: vi.fn() },
}));

vi.mock("@/lib/auth/supabase-client", () => ({
  createClient: () => ({ auth }),
}));

const github = { value: "github", label: "GitHub" } as const;

describe("AuthButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    auth.signInWithOAuth.mockResolvedValue({ error: null });
  });

  it("signs in and comes back to the board", async () => {
    render(<AuthButton provider={github} />);

    await userEvent.click(
      screen.getByRole("button", { name: "Sign in with GitHub" }),
    );

    await waitFor(() =>
      expect(auth.signInWithOAuth).toHaveBeenCalledWith({
        provider: "github",
        options: {
          redirectTo: `${window.location.origin}/auth/callback?next=%2Fmain`,
        },
      }),
    );
  });

  it("comes back where it was sent from", async () => {
    render(<AuthButton provider={github} next="/share/tok" />);

    await userEvent.click(
      screen.getByRole("button", { name: "Sign in with GitHub" }),
    );

    await waitFor(() =>
      expect(auth.signInWithOAuth).toHaveBeenCalledWith({
        provider: "github",
        options: {
          redirectTo: `${window.location.origin}/auth/callback?next=%2Fshare%2Ftok`,
        },
      }),
    );
  });
});
