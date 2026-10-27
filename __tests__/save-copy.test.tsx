import SaveCopy from "@/app/share/[token]/save-copy";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const push = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

describe("SaveCopy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", vi.fn());
  });

  it("sends a signed-out visitor to sign in and back", () => {
    render(<SaveCopy token="tok" signedIn={false} />);

    expect(
      screen.getByRole("link", { name: "Sign in to save a copy" }),
    ).toHaveAttribute("href", "/?next=%2Fshare%2Ftok");
  });

  it("saves a copy and opens it", async () => {
    vi.mocked(fetch).mockResolvedValue(Response.json({ bucketId: 50 }));
    render(<SaveCopy token="tok" signedIn />);

    await userEvent.click(screen.getByRole("button", { name: "Save a copy" }));

    expect(fetch).toHaveBeenCalledWith("/api/buckets/copy", {
      method: "POST",
      body: JSON.stringify({ token: "tok" }),
    });
    expect(push).toHaveBeenCalledWith("/main/buckets/50");
  });

  it("says so and lets you retry when saving fails", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response("no", { status: 500 }));
    vi.spyOn(console, "error").mockImplementation(() => {});
    render(<SaveCopy token="tok" signedIn />);

    await userEvent.click(screen.getByRole("button", { name: "Save a copy" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Couldn't save a copy",
    );
    expect(push).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Save a copy" })).toBeEnabled();
  });
});
