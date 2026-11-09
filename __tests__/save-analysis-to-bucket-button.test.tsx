import { SaveAnalysisToBucketButton } from "@/app/components/save-analysis-to-bucket-button";
import { ToastContext } from "@/app/context/toast.provider";
import type {
  AnalysisPayload,
  BucketRefinementResult,
  GameplanResult,
  PathwayId,
} from "@/lib/types";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { refresh, setToasts } = vi.hoisted(() => ({
  refresh: vi.fn(),
  setToasts: vi.fn(),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

const refinement: BucketRefinementResult = {
  bucket_id: 5,
  original_name: "Launch",
  original_description: "Build it",
  refined_name: "Small launch",
  refined_description: "Ship one useful feature",
  refined_category: "software",
  improvements: ["Narrow the audience", "Test demand", "Ship a prototype"],
  reasoning: { main_idea: "Start small", reasons: [] },
};
const gameplan: GameplanResult = {
  bucket_id: 5,
  bucket_name: "Launch",
  finish_line: "Ship it",
  where_you_are: "Starting",
  first_step: { title: "Sketch", detail: "Draw a screen" },
  phases: [],
  cut: [],
  risks: [],
};

function renderButton(
  result: AnalysisPayload = refinement,
  analysisType: PathwayId = "refinement",
) {
  return render(
    <ToastContext.Provider value={{ toasts: [], setToasts }}>
      <SaveAnalysisToBucketButton
        analysisId={7}
        analysisType={analysisType}
        result={result}
      />
    </ToastContext.Provider>,
  );
}
async function openDialog() {
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Save to bucket" }));
  return user;
}

describe("SaveAnalysisToBucketButton", () => {
  const originalShowModal = Object.getOwnPropertyDescriptor(
    HTMLDialogElement.prototype,
    "showModal",
  );
  const originalClose = Object.getOwnPropertyDescriptor(
    HTMLDialogElement.prototype,
    "close",
  );

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));
    Object.defineProperty(HTMLDialogElement.prototype, "showModal", {
      configurable: true,
      value: function (this: HTMLDialogElement) {
        this.setAttribute("open", "");
      },
    });
    Object.defineProperty(HTMLDialogElement.prototype, "close", {
      configurable: true,
      value: function (this: HTMLDialogElement) {
        this.removeAttribute("open");
      },
    });
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    if (originalShowModal)
      Object.defineProperty(
        HTMLDialogElement.prototype,
        "showModal",
        originalShowModal,
      );
    else Reflect.deleteProperty(HTMLDialogElement.prototype, "showModal");
    if (originalClose)
      Object.defineProperty(
        HTMLDialogElement.prototype,
        "close",
        originalClose,
      );
    else Reflect.deleteProperty(HTMLDialogElement.prototype, "close");
  });

  it("opens refinement options and can cancel without saving", async () => {
    renderButton();
    const user = await openDialog();
    expect(
      screen.getByRole("dialog", { name: "Save to Launch?" }),
    ).toHaveTextContent("version history");
    expect(fetch).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("applies the refinement to its original bucket and refreshes", async () => {
    renderButton();
    expect(screen.getByTestId("save-analysis-to-bucket")).toHaveTextContent(
      "Save to bucket",
    );
    const user = await openDialog();
    expect(
      screen.getByRole("checkbox", { name: /Update bucket/ }),
    ).toBeChecked();
    expect(
      screen.getByRole("radio", { name: "Add selected ideas" }),
    ).toBeChecked();
    for (const text of refinement.improvements) {
      expect(screen.getByRole("checkbox", { name: text })).toBeChecked();
    }
    expect(fetch).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Confirm save" }));
    expect(fetch).toHaveBeenCalledExactlyOnceWith(
      "/api/buckets/apply-refinement",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bucketId: 5,
          name: "Small launch",
          description: "Ship one useful feature",
          category: "software",
          updateDetails: true,
          ideasMode: "add",
          ideas: refinement.improvements.map((text) => ({
            title: text.slice(0, 200),
            description: text,
          })),
        }),
      },
    );
    expect(
      screen.getByRole("button", { name: "Saved to bucket" }),
    ).toBeDisabled();
    expect(refresh).toHaveBeenCalled();
    expect(setToasts).toHaveBeenCalledWith([
      { id: 5, message: "Refinement saved to bucket", type: "success" },
    ]);
  });

  it("links the existing gameplan without saving a duplicate analysis", async () => {
    renderButton(gameplan, "gameplan");
    const user = await openDialog();
    expect(screen.getByRole("dialog")).toHaveTextContent(
      "previous gameplan stays",
    );
    await user.click(screen.getByRole("button", { name: "Confirm save" }));
    expect(fetch).toHaveBeenCalledExactlyOnceWith(
      "/api/analysis/save-to-bucket",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ analysisId: 7 }),
      },
    );
    expect(refresh).toHaveBeenCalled();
  });

  it("shows server errors and allows retry", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: "Bucket not found" }),
    } as Response);
    renderButton();
    const user = await openDialog();
    await user.click(screen.getByRole("button", { name: "Confirm save" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Bucket not found");
    expect(refresh).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Confirm save" }));
    expect(
      screen.getByRole("button", { name: "Saved to bucket" }),
    ).toBeDisabled();
  });

  it("blocks duplicate saves and dismissal while pending", async () => {
    let resolve!: (value: Response) => void;
    vi.mocked(fetch).mockReturnValue(
      new Promise((r) => {
        resolve = r;
      }),
    );
    renderButton();
    const user = await openDialog();
    await user.click(screen.getByRole("button", { name: "Confirm save" }));
    expect(screen.getByRole("button", { name: "Saving..." })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
    const cancel = new Event("cancel", { cancelable: true });
    screen.getByRole("dialog").dispatchEvent(cancel);
    expect(cancel.defaultPrevented).toBe(true);
    await act(async () => resolve({ ok: true } as Response));
    await waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["execution", { choices: [], summary: "Nothing" }],
    [
      "refinement",
      { suggestions: [], reasoning: { main_idea: "", reasons: [] } },
    ],
    ["refinement", { ...refinement, bucket_id: -1 }],
    ["execution", gameplan],
  ] as [PathwayId, AnalysisPayload][])(
    "hides unsupported or invalid %s results",
    (type, result) => {
      renderButton(result, type);
      expect(
        screen.queryByRole("button", { name: "Save to bucket" }),
      ).not.toBeInTheDocument();
    },
  );
});
