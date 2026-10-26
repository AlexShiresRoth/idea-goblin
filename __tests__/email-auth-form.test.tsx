import EmailAuthForm from "@/app/components/email-auth-form";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { auth, push } = vi.hoisted(() => ({
  auth: {
    signInWithPassword: vi.fn(),
    signUp: vi.fn(),
    resetPasswordForEmail: vi.fn(),
  },
  push: vi.fn(),
}));

vi.mock("@/lib/auth/supabase-client", () => ({
  createClient: () => ({ auth }),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

async function fill(fields: Record<string, string>) {
  for (const [label, value] of Object.entries(fields)) {
    await userEvent.type(screen.getByLabelText(label), value);
  }
}

describe("EmailAuthForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("signs in and goes to the board", async () => {
    auth.signInWithPassword.mockResolvedValue({ error: null });
    render(<EmailAuthForm />);

    await fill({ Email: "a@b.co", Password: "hunter22" });
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() => expect(push).toHaveBeenCalledWith("/main"));
    expect(auth.signInWithPassword).toHaveBeenCalledWith({
      email: "a@b.co",
      password: "hunter22",
    });
  });

  it("goes back where it was sent from, like a shared bucket", async () => {
    auth.signInWithPassword.mockResolvedValue({ error: null });
    auth.signUp.mockResolvedValue({ data: { session: null }, error: null });
    render(<EmailAuthForm next="/share/tok" />);

    await fill({ Email: "a@b.co", Password: "hunter22" });
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/share/tok"));

    // Confirming a new account's email lands there too.
    await userEvent.click(
      screen.getByRole("button", { name: "Create an account" }),
    );
    await fill({ Name: "Gob" });
    await userEvent.click(
      screen.getByRole("button", { name: "Create account" }),
    );
    expect(auth.signUp).toHaveBeenCalledWith(
      expect.objectContaining({
        options: expect.objectContaining({
          emailRedirectTo: `${window.location.origin}/auth/callback?next=%2Fshare%2Ftok`,
        }),
      }),
    );
  });

  it("shows a sign-in error and stays put", async () => {
    auth.signInWithPassword.mockResolvedValue({
      error: { message: "Invalid login credentials" },
    });
    render(<EmailAuthForm />);

    await fill({ Email: "a@b.co", Password: "wrongpass" });
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Invalid login credentials",
    );
    expect(push).not.toHaveBeenCalled();
  });

  it("signs up with a name and asks to confirm the email", async () => {
    auth.signUp.mockResolvedValue({ data: { session: null }, error: null });
    render(<EmailAuthForm />);

    await userEvent.click(
      screen.getByRole("button", { name: "Create an account" }),
    );
    await fill({ Name: "Gob", Email: "a@b.co", Password: "hunter22" });
    await userEvent.click(
      screen.getByRole("button", { name: "Create account" }),
    );

    expect(await screen.findByText(/Check your email/)).toBeInTheDocument();
    expect(auth.signUp).toHaveBeenCalledWith({
      email: "a@b.co",
      password: "hunter22",
      options: {
        data: { name: "Gob" },
        emailRedirectTo: `${window.location.origin}/auth/callback?next=%2Fmain`,
      },
    });
    expect(push).not.toHaveBeenCalled();
  });

  it("goes straight to the board when sign-up returns a session", async () => {
    auth.signUp.mockResolvedValue({ data: { session: {} }, error: null });
    render(<EmailAuthForm />);

    await userEvent.click(
      screen.getByRole("button", { name: "Create an account" }),
    );
    await fill({ Name: "Gob", Email: "a@b.co", Password: "hunter22" });
    await userEvent.click(
      screen.getByRole("button", { name: "Create account" }),
    );

    await waitFor(() => expect(push).toHaveBeenCalledWith("/main"));
  });

  it("sends a reset link that lands on the update-password page", async () => {
    auth.resetPasswordForEmail.mockResolvedValue({ error: null });
    render(<EmailAuthForm />);

    await userEvent.click(
      screen.getByRole("button", { name: "Forgot password?" }),
    );
    expect(screen.queryByLabelText("Password")).not.toBeInTheDocument();
    await fill({ Email: "a@b.co" });
    await userEvent.click(
      screen.getByRole("button", { name: "Send reset link" }),
    );

    expect(await screen.findByText(/sent a link/)).toBeInTheDocument();
    expect(auth.resetPasswordForEmail).toHaveBeenCalledWith("a@b.co", {
      redirectTo: `${window.location.origin}/auth/callback?next=%2Fauth%2Fupdate-password`,
    });
  });
});
