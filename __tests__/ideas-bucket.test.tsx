import IdeasBucket from "@/app/main/ideas-bucket";
import { ToastContext } from "@/app/context/toast.provider";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeBucket, makeIdea } from "./helpers";

const refresh = vi.fn();
const setToasts = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
}));

function renderBucket() {
  return render(
    <ToastContext.Provider value={{ toasts: [], setToasts }}>
      <IdeasBucket
        bucket={makeBucket()}
        ideas={[makeIdea({ title: "Nested idea" })]}
      />
    </ToastContext.Provider>,
  );
}

describe("IdeasBucket", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ message: "Bucket deleted successfully" }),
      }),
    );
  });

  it("renders the bucket summary and hides ideas until expanded", () => {
    renderBucket();

    expect(screen.getByText("Launch ideas")).toBeInTheDocument();
    expect(screen.getByText("growth")).toBeInTheDocument();
    expect(screen.getByText("Nested idea").closest(".hidden")).toBeTruthy();
    expect(screen.queryByText("Delete")).not.toBeInTheDocument();
  });

  it("expands to show ideas and delete", async () => {
    const user = userEvent.setup();
    renderBucket();

    await user.click(screen.getByLabelText("button"));

    expect(screen.getByText("Nested idea").closest(".hidden")).toBeNull();
    expect(screen.getByText("Delete")).toBeInTheDocument();
  });

  it("deletes the bucket, toasts success, and refreshes", async () => {
    const user = userEvent.setup();
    renderBucket();

    await user.click(screen.getByLabelText("button"));
    await user.click(screen.getByText("Delete"));

    expect(fetch).toHaveBeenCalledWith("/api/buckets/delete", {
      method: "DELETE",
      body: JSON.stringify({ bucketId: 10 }),
    });
    expect(setToasts).toHaveBeenCalledWith([
      {
        id: 10,
        message: "Deleted bucket: Launch ideas",
        type: "success",
      },
    ]);
    expect(refresh).toHaveBeenCalled();
  });
});
