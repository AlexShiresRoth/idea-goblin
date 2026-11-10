import { RestoreBucketButton } from "@/app/components/restore-bucket-button";
import { ToastContext } from "@/app/context/toast.provider";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { push, refresh, setToasts } = vi.hoisted(() => ({
  push: vi.fn(),
  refresh: vi.fn(),
  setToasts: vi.fn(),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh }) }));

function renderButton() {
  return render(
    <ToastContext.Provider value={{ toasts: [], setToasts }}>
      <RestoreBucketButton bucketId={10} />
    </ToastContext.Provider>,
  );
}

function successResponse() {
  return new Response(JSON.stringify({ message: "Bucket restored successfully" }), { status: 200 });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(successResponse()));
});
afterEach(() => vi.unstubAllGlobals());

describe("RestoreBucketButton", () => {
  it("posts the bucket ID, toasts the success message, and refreshes without navigating", async () => {
    renderButton();
    expect(screen.getByRole("button", { name: "Restore" })).toHaveClass("action-button", "text-accent", "rounded-none");
    await userEvent.setup().click(screen.getByRole("button", { name: "Restore" }));

    expect(fetch).toHaveBeenCalledWith("/api/buckets/restore", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bucketId: 10 }),
    });
    await waitFor(() => expect(refresh).toHaveBeenCalledOnce());
    expect(setToasts).toHaveBeenCalledWith([
      { id: 10, message: "Bucket restored successfully", type: "success" },
    ]);
    expect(push).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Restored" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Restored" }));
    expect(fetch).toHaveBeenCalledOnce();
  });

  it("blocks same-tick double submission and stays disabled while pending", async () => {
    let resolve!: (response: Response) => void;
    vi.mocked(fetch).mockReturnValue(new Promise((r) => { resolve = r; }));
    renderButton();
    const button = screen.getByRole("button", { name: "Restore" });

    act(() => {
      button.click();
      button.click();
    });

    expect(fetch).toHaveBeenCalledOnce();
    expect(screen.getByRole("button", { name: "Restoring..." })).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
    fireEvent.click(button);
    expect(fetch).toHaveBeenCalledOnce();
    expect(refresh).not.toHaveBeenCalled();
    await act(async () => resolve(successResponse()));
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("shows an inline API error and allows retry, clearing the error while pending", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({ error: "Bucket not found" }), { status: 404 }));
    renderButton();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Restore" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Bucket not found");
    const button = screen.getByRole("button", { name: "Restore" });
    expect(button).toBeEnabled();
    expect(button).toHaveAttribute("aria-describedby", screen.getByRole("alert").id);
    expect(setToasts).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();

    let resolve!: (response: Response) => void;
    vi.mocked(fetch).mockReturnValueOnce(new Promise((r) => { resolve = r; }));
    await user.click(button);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Restoring..." })).toBeDisabled();
    await act(async () => resolve(successResponse()));
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("handles network failures inline without toasting or navigating", async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error("Network unavailable"));
    renderButton();
    await userEvent.setup().click(screen.getByRole("button", { name: "Restore" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Network unavailable");
    expect(screen.getByRole("button", { name: "Restore" })).toBeEnabled();
    expect(setToasts).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
  });

  it("uses a retryable fallback for a non-JSON error response", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response("Unavailable", { status: 503 }));
    renderButton();
    await userEvent.setup().click(screen.getByRole("button", { name: "Restore" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Failed to restore bucket. Please try again.");
    expect(screen.getByRole("button", { name: "Restore" })).toBeEnabled();
    expect(refresh).not.toHaveBeenCalled();
  });
});
