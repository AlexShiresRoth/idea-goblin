import { DeleteAnalysisButton } from "@/app/components/delete-analysis-button";
import { ToastContext } from "@/app/context/toast.provider";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const push = vi.fn();
const refresh = vi.fn();
const setToasts = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh }),
}));

function renderButton(redirectTo?: string) {
  return render(
    <ToastContext.Provider value={{ toasts: [], setToasts }}>
      <DeleteAnalysisButton analysisId={7} redirectTo={redirectTo} />
    </ToastContext.Provider>,
  );
}

// The dialog ignores dismissals for its first 250ms so the click that opened
// it can't immediately close it. Timers are faked (but still advance on their
// own), so tests can step past the guard exactly instead of sleeping.
async function waitForDismissable() {
  await act(() => vi.advanceTimersByTimeAsync(250));
}

async function openDialog(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "Delete" }));
  return screen.getByRole("dialog", { name: "Delete this analysis?" });
}

function confirmButton() {
  // The trigger and the confirm button are both named "Delete"; the confirm
  // one is rendered last, inside the dialog portal.
  const buttons = screen.getAllByRole("button", { name: "Delete" });
  return buttons[buttons.length - 1];
}

describe("DeleteAnalysisButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("asks for confirmation before deleting", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderButton();

    const dialog = await openDialog(user);

    expect(dialog).toHaveTextContent("This cannot be undone.");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("does not trigger a parent click handler when opening", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const parentClick = vi.fn();
    render(
      <div onClick={parentClick}>
        <DeleteAnalysisButton analysisId={7} />
      </div>,
    );

    await user.click(screen.getByRole("button", { name: "Delete" }));

    expect(parentClick).not.toHaveBeenCalled();
  });

  it("closes on Cancel without deleting", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderButton();

    await openDialog(user);
    await waitForDismissable();
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("ignores Cancel in the first moment after opening", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderButton();

    await openDialog(user);
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("closes when the backdrop is clicked, but not the dialog itself", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderButton();

    const dialog = await openDialog(user);
    await waitForDismissable();

    await user.click(dialog);
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    await user.click(dialog.parentElement!);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("deletes, toasts and refreshes when there is no redirect", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderButton();

    await openDialog(user);
    await user.click(confirmButton());

    expect(fetch).toHaveBeenCalledWith("/api/analysis/delete", {
      method: "DELETE",
      body: JSON.stringify({ analysisId: 7 }),
    });
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    expect(setToasts).toHaveBeenCalledWith([
      { id: 7, message: "Analysis deleted", type: "success" },
    ]);
    expect(refresh).toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
  });

  it("redirects after deleting when given a redirect", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderButton("/main/analysis");

    await openDialog(user);
    await user.click(confirmButton());

    await waitFor(() => expect(push).toHaveBeenCalledWith("/main/analysis"));
    expect(refresh).not.toHaveBeenCalled();
  });

  it("shows a deleting state and blocks Cancel while the request runs", async () => {
    let resolve: (value: { ok: boolean }) => void = () => {};
    vi.mocked(fetch).mockReturnValue(
      new Promise((r) => {
        resolve = r;
      }) as never,
    );
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderButton();

    await openDialog(user);
    await waitForDismissable();
    await user.click(confirmButton());

    expect(screen.getByRole("button", { name: "Deleting..." })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();

    await act(async () => resolve({ ok: true }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("shows an error toast and keeps the dialog open when the request fails", async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: false } as Response);
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderButton("/main/analysis");

    await openDialog(user);
    await user.click(confirmButton());

    await waitFor(() =>
      expect(setToasts).toHaveBeenCalledWith([
        { id: 7, message: "Failed to delete analysis", type: "error" },
      ]),
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(confirmButton()).toBeEnabled();
    expect(push).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
  });

  it("shows an error toast when the network request throws", async () => {
    vi.mocked(fetch).mockRejectedValue(new Error("offline"));
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderButton();

    await openDialog(user);
    await user.click(confirmButton());

    await waitFor(() =>
      expect(setToasts).toHaveBeenCalledWith([
        { id: 7, message: "Failed to delete analysis", type: "error" },
      ]),
    );
  });
});
