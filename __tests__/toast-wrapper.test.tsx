import { ToastWrapper } from "@/app/components/toast-wrapper";
import { ToastContext, type Toast } from "@/app/context/toast.provider";
import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const toasts: Toast[] = [
  { id: 1, message: "Idea gone", type: "success" },
  { id: 2, message: "Could not delete", type: "error" },
];

describe("ToastWrapper", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders current toasts and dismisses them after 5 seconds", () => {
    const setToasts = vi.fn();

    render(
      <ToastContext.Provider value={{ toasts, setToasts }}>
        <ToastWrapper>
          <p>Workspace</p>
        </ToastWrapper>
      </ToastContext.Provider>,
    );

    expect(screen.getByText("Workspace")).toBeInTheDocument();
    expect(screen.getByText("Idea gone")).toBeInTheDocument();
    expect(screen.getByText("Could not delete")).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(setToasts).toHaveBeenCalled();
  });
});
