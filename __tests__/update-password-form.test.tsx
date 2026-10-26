import UpdatePasswordForm from "@/app/components/update-password-form";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { updateUser, push } = vi.hoisted(() => ({
  updateUser: vi.fn(),
  push: vi.fn(),
}));

vi.mock("@/lib/auth/supabase-client", () => ({
  createClient: () => ({ auth: { updateUser } }),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

async function submit(password: string, confirm: string) {
  await userEvent.type(screen.getByLabelText("New password"), password);
  await userEvent.type(screen.getByLabelText("Confirm new password"), confirm);
  await userEvent.click(screen.getByRole("button", { name: "Save password" }));
}

describe("UpdatePasswordForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("saves the new password and goes to the board", async () => {
    updateUser.mockResolvedValue({ error: null });
    render(<UpdatePasswordForm />);

    await submit("newpass123", "newpass123");

    await waitFor(() => expect(push).toHaveBeenCalledWith("/main"));
    expect(updateUser).toHaveBeenCalledWith({ password: "newpass123" });
  });

  it("stops when the passwords don't match", async () => {
    render(<UpdatePasswordForm />);

    await submit("newpass123", "newpass124");

    expect(screen.getByRole("alert")).toHaveTextContent("don't match");
    expect(updateUser).not.toHaveBeenCalled();
  });

  it("shows an error from Supabase", async () => {
    updateUser.mockResolvedValue({
      error: { message: "New password should be different" },
    });
    render(<UpdatePasswordForm />);

    await submit("oldpass123", "oldpass123");

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "should be different",
    );
    expect(push).not.toHaveBeenCalled();
  });
});
