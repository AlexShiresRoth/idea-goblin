import { ToastContext } from "@/app/context/toast.provider";
import BucketShare from "@/app/main/bucket-share";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const refresh = vi.fn();
const setToasts = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
}));

function renderShare(shareToken: string | null = null) {
  return render(
    <ToastContext.Provider value={{ toasts: [], setToasts }}>
      <BucketShare bucketId={10} shareToken={shareToken} />
    </ToastContext.Provider>,
  );
}

function respond(shareToken: string | null) {
  vi.mocked(fetch).mockResolvedValue(Response.json({ shareToken }));
}

function shareBodies() {
  return vi
    .mocked(fetch)
    .mock.calls.filter(([url]) => url === "/api/buckets/share")
    .map(([, init]) => JSON.parse(String(init?.body)));
}

async function openDialog(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: /Share/ }));
  return within(screen.getByRole("dialog", { name: "Share this bucket" }));
}

describe("BucketShare", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", vi.fn());
  });

  it("creates a link for an unshared bucket", async () => {
    respond("tok");
    const user = userEvent.setup();
    renderShare();

    const dialog = await openDialog(user);
    await user.click(dialog.getByRole("button", { name: "Create link" }));

    expect(shareBodies()).toEqual([{ bucketId: 10, action: "enable" }]);
    expect(await dialog.findByLabelText("Share link")).toHaveValue(
      "http://localhost:3000/share/tok",
    );
    expect(refresh).toHaveBeenCalled();
  });

  it("copies the link and says so on the button", async () => {
    const user = userEvent.setup();
    const writeText = vi
      .spyOn(navigator.clipboard, "writeText")
      .mockResolvedValue();
    renderShare("tok");

    const dialog = await openDialog(user);
    await user.click(dialog.getByRole("button", { name: "Copy" }));

    expect(writeText).toHaveBeenCalledWith("http://localhost:3000/share/tok");
    expect(dialog.getByRole("button", { name: "Copied" })).toBeInTheDocument();
    expect(
      await dialog.findByRole("button", { name: "Copy" }, { timeout: 3000 }),
    ).toBeInTheDocument();
  });

  it("says so on the button when copying fails", async () => {
    const user = userEvent.setup();
    vi.spyOn(navigator.clipboard, "writeText").mockRejectedValue(
      new Error("denied"),
    );
    vi.spyOn(console, "error").mockImplementation(() => {});
    renderShare("tok");

    const dialog = await openDialog(user);
    await user.click(dialog.getByRole("button", { name: "Copy" }));

    expect(
      dialog.getByRole("button", { name: "Copy failed" }),
    ).toBeInTheDocument();
  });

  it("replaces the link with a new one", async () => {
    respond("fresh");
    const user = userEvent.setup();
    renderShare("tok");

    const dialog = await openDialog(user);
    await user.click(dialog.getByRole("button", { name: "New link" }));

    expect(shareBodies()).toEqual([{ bucketId: 10, action: "regenerate" }]);
    expect(
      await dialog.findByDisplayValue(/\/share\/fresh$/),
    ).toBeInTheDocument();
  });

  it("stops sharing", async () => {
    respond(null);
    const user = userEvent.setup();
    renderShare("tok");

    const dialog = await openDialog(user);
    await user.click(dialog.getByRole("button", { name: "Stop sharing" }));

    expect(shareBodies()).toEqual([{ bucketId: 10, action: "disable" }]);
    expect(
      await dialog.findByRole("button", { name: "Create link" }),
    ).toBeInTheDocument();
    expect(dialog.queryByLabelText("Share link")).not.toBeInTheDocument();
  });

  it("keeps the link and toasts when the update fails", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response("no", { status: 500 }));
    vi.spyOn(console, "error").mockImplementation(() => {});
    const user = userEvent.setup();
    renderShare("tok");

    const dialog = await openDialog(user);
    await user.click(dialog.getByRole("button", { name: "Stop sharing" }));

    expect(setToasts).toHaveBeenCalledWith([
      expect.objectContaining({
        message: "Failed to update the share link",
        type: "error",
      }),
    ]);
    expect(dialog.getByLabelText("Share link")).toBeInTheDocument();
    expect(refresh).not.toHaveBeenCalled();
  });

  it("closes", async () => {
    const user = userEvent.setup();
    renderShare();

    const dialog = await openDialog(user);
    await user.click(dialog.getByRole("button", { name: "Close" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
