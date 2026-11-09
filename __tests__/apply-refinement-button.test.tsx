import { ApplyRefinementButton } from "@/app/components/apply-refinement-button";
import { ToastContext } from "@/app/context/toast.provider";
import type { BucketRefinementResult } from "@/lib/types";
import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { refresh, setToasts } = vi.hoisted(() => ({
  refresh: vi.fn(),
  setToasts: vi.fn(),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

type Result = BucketRefinementResult & {
  suggested_ideas?: { title: string; description: string }[];
};
const result: Result = {
  bucket_id: 5,
  original_name: "Launch",
  original_description: "Build it",
  refined_name: "Small launch",
  refined_description: "Ship one useful feature",
  refined_category: "software",
  improvements: ["Narrow the audience", "Test demand", "Ship a prototype"],
  reasoning: { main_idea: "Start small", reasons: [] },
  suggested_ideas: [
    {
      title: "Interview users",
      description: "Talk to five potential customers.",
    },
    { title: "Build a demo", description: "Make one feature work." },
    { title: "Find testers", description: "Invite early adopters." },
  ],
};

function button(draft: Result = result, onApplied = vi.fn()) {
  return (
    <ToastContext.Provider value={{ toasts: [], setToasts }}>
      <ApplyRefinementButton
        result={draft}
        testId="apply-refinement"
        onApplied={onApplied}
      />
    </ToastContext.Provider>
  );
}
async function openDialog() {
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Save to bucket" }));
  return user;
}
function payload() {
  const [, options] = vi.mocked(fetch).mock.calls.at(-1)!;
  return JSON.parse(options!.body as string);
}
const details = {
  bucketId: 5,
  name: "Small launch",
  description: "Ship one useful feature",
  category: "software",
};

describe("ApplyRefinementButton", () => {
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

  it("defaults to updating details and adding every suggested idea, then notifies and disables", async () => {
    const onApplied = vi.fn();
    render(button(result, onApplied));
    expect(screen.getByTestId("apply-refinement")).toHaveTextContent(
      "Save to bucket",
    );
    const user = await openDialog();
    expect(
      screen.getByRole("dialog", { name: "Save to Launch?" }),
    ).toHaveAccessibleDescription(/version history/);
    expect(
      screen.getByRole("checkbox", { name: /Update bucket/ }),
    ).toBeChecked();
    expect(
      screen.getByRole("radio", { name: "Add selected ideas" }),
    ).toBeChecked();
    for (const idea of result.suggested_ideas!) {
      expect(screen.getByRole("checkbox", { name: idea.title })).toBeChecked();
      expect(screen.getByText(idea.description)).toBeInTheDocument();
    }
    await user.click(screen.getByRole("button", { name: "Confirm save" }));
    expect(fetch).toHaveBeenCalledExactlyOnceWith(
      "/api/buckets/apply-refinement",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...details,
          updateDetails: true,
          ideasMode: "add",
          ideas: result.suggested_ideas,
        }),
      },
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Saved to bucket" }),
    ).toBeDisabled();
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(onApplied).toHaveBeenCalledTimes(1);
    expect(setToasts).toHaveBeenCalledWith([
      { id: 5, message: "Refinement saved to bucket", type: "success" },
    ]);
  });

  it("adds only the chosen subset and can leave bucket details unchanged", async () => {
    render(button());
    const user = await openDialog();
    await user.click(screen.getByRole("checkbox", { name: "Build a demo" }));
    await user.click(screen.getByRole("checkbox", { name: /Update bucket/ }));
    await user.click(screen.getByRole("button", { name: "Confirm save" }));
    expect(payload()).toEqual({
      ...details,
      updateDetails: false,
      ideasMode: "add",
      ideas: [result.suggested_ideas![0], result.suggested_ideas![2]],
    });
  });

  it("warns that replace removes all current ideas including completed ones and posts the selection", async () => {
    render(button());
    const user = await openDialog();
    await user.click(
      screen.getByRole("radio", { name: /Replace current ideas/ }),
    );
    expect(screen.getByRole("note")).toHaveTextContent("ALL current ideas");
    expect(screen.getByRole("note")).toHaveTextContent(
      "including completed ideas",
    );
    expect(screen.getByRole("note")).toHaveTextContent("version history");
    expect(screen.getByRole("note")).toHaveTextContent(
      "Original ideas in other buckets remain unchanged",
    );
    await user.click(screen.getByRole("checkbox", { name: "Interview users" }));
    await user.click(screen.getByRole("button", { name: "Confirm save" }));
    expect(payload()).toEqual({
      ...details,
      updateDetails: true,
      ideasMode: "replace",
      ideas: result.suggested_ideas!.slice(1),
    });
  });

  it("sends no ideas for details only, even with suggestions selected", async () => {
    render(button());
    const user = await openDialog();
    await user.click(screen.getByRole("radio", { name: /Keep current ideas/ }));
    expect(
      screen.getByRole("checkbox", { name: "Interview users" }),
    ).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Confirm save" }));
    expect(payload()).toEqual({
      ...details,
      updateDetails: true,
      ideasMode: "none",
      ideas: [],
    });
  });

  it.each(["add", "replace"])(
    "requires a selection for %s and prevents a details-only no-op",
    async (mode) => {
      render(button());
      const user = await openDialog();
      if (mode === "replace")
        await user.click(
          screen.getByRole("radio", { name: /Replace current ideas/ }),
        );
      for (const idea of result.suggested_ideas!) {
        await user.click(screen.getByRole("checkbox", { name: idea.title }));
      }
      expect(
        screen.getByRole("button", { name: "Confirm save" }),
      ).toBeDisabled();
      expect(
        screen.getByText(/Select at least one suggested idea/),
      ).toBeInTheDocument();
      await user.click(
        screen.getByRole("radio", { name: /Keep current ideas/ }),
      );
      expect(
        screen.getByRole("button", { name: "Confirm save" }),
      ).toBeEnabled();
      await user.click(screen.getByRole("checkbox", { name: /Update bucket/ }));
      expect(
        screen.getByRole("button", { name: "Confirm save" }),
      ).toBeDisabled();
      await user.click(screen.getByRole("button", { name: "Confirm save" }));
      expect(fetch).not.toHaveBeenCalled();
    },
  );

  it("maps all three legacy improvements into ideas and explains the fallback", async () => {
    const legacy = { ...result, suggested_ideas: undefined };
    render(button(legacy));
    const user = await openDialog();
    expect(
      screen.getByText(
        "This older result uses improvements as suggested ideas.",
      ),
    ).toBeInTheDocument();
    for (const text of legacy.improvements!) {
      expect(screen.getByRole("checkbox", { name: text })).toBeChecked();
    }
    await user.click(screen.getByRole("button", { name: "Confirm save" }));
    expect(payload().ideas).toEqual(
      legacy.improvements!.map((text) => ({
        title: text.slice(0, 200),
        description: text,
      })),
    );
    expect(payload().ideas).toHaveLength(3);
  });

  it("truncates legacy titles at 200 characters without truncating descriptions", async () => {
    const text = "a".repeat(240);
    render(
      button({ ...result, suggested_ideas: undefined, improvements: [text] }),
    );
    const user = await openDialog();
    expect(
      screen.getByRole("checkbox", { name: text.slice(0, 200) }),
    ).toBeChecked();
    await user.click(screen.getByRole("button", { name: "Confirm save" }));
    expect(payload().ideas).toEqual([
      { title: text.slice(0, 200), description: text },
    ]);
  });

  it.each([undefined, []])(
    "defaults to none without suggestions (%j)",
    async (suggested_ideas) => {
      render(button({ ...result, improvements: [], suggested_ideas }));
      const user = await openDialog();
      expect(
        screen.getByRole("radio", { name: /Keep current ideas/ }),
      ).toBeChecked();
      await user.click(screen.getByRole("button", { name: "Confirm save" }));
      expect(payload()).toEqual({
        ...details,
        updateDetails: true,
        ideasMode: "none",
        ideas: [],
      });
    },
  );

  it("does not use legacy improvements when an explicit empty suggestion list exists", async () => {
    render(button({ ...result, suggested_ideas: [] }));
    await openDialog();
    expect(
      screen.getByRole("radio", { name: /Keep current ideas/ }),
    ).toBeChecked();
    expect(screen.queryByText(/older result/)).not.toBeInTheDocument();
    expect(screen.getAllByRole("checkbox")).toHaveLength(1);
  });

  it("shows server errors inline and retries with the same selection", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: "Bucket not found" }),
    } as Response);
    const onApplied = vi.fn();
    render(button(result, onApplied));
    const user = await openDialog();
    await user.click(screen.getByRole("checkbox", { name: "Build a demo" }));
    await user.click(screen.getByRole("button", { name: "Confirm save" }));
    const firstPayload = payload();
    expect(screen.getByRole("alert")).toHaveTextContent("Bucket not found");
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(refresh).not.toHaveBeenCalled();
    expect(onApplied).not.toHaveBeenCalled();
    expect(setToasts).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Confirm save" }));
    expect(payload()).toEqual(firstPayload);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(
      screen.getByRole("button", { name: "Saved to bucket" }),
    ).toBeDisabled();
  });

  it.each(["network", "non-json"])(
    "allows retry after a %s error",
    async (kind) => {
      if (kind === "network")
        vi.mocked(fetch).mockRejectedValueOnce(
          new Error("Network unavailable"),
        );
      else
        vi.mocked(fetch).mockResolvedValueOnce({
          ok: false,
          json: async () => {
            throw new Error("Invalid JSON");
          },
        } as unknown as Response);
      render(button());
      const user = await openDialog();
      await user.click(screen.getByRole("button", { name: "Confirm save" }));
      expect(screen.getByRole("alert")).toHaveTextContent(
        kind === "network"
          ? "Network unavailable"
          : "Failed to save to bucket. Please try again.",
      );
      await user.click(screen.getByRole("button", { name: "Confirm save" }));
      expect(refresh).toHaveBeenCalledTimes(1);
    },
  );

  it("blocks escape, cancel, changes, and double requests while pending", async () => {
    let resolve!: (response: Response) => void;
    vi.mocked(fetch).mockReturnValue(
      new Promise((done) => {
        resolve = done;
      }),
    );
    render(button());
    const user = await openDialog();
    await user.dblClick(screen.getByRole("button", { name: "Confirm save" }));
    expect(screen.getByRole("button", { name: "Saving..." })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Save to bucket" }),
    ).toBeDisabled();
    for (const control of [
      ...screen.getAllByRole("checkbox"),
      ...screen.getAllByRole("radio"),
    ]) {
      expect(control).toBeDisabled();
    }
    const cancel = new Event("cancel", { cancelable: true });
    fireEvent(screen.getByRole("dialog"), cancel);
    expect(cancel.defaultPrevented).toBe(true);
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledTimes(1);
    await act(async () => resolve({ ok: true } as Response));
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("allows native escape and cancel when idle without sending a request", async () => {
    render(button());
    const user = await openDialog();
    const cancel = new Event("cancel", { cancelable: true });
    fireEvent(screen.getByRole("dialog"), cancel);
    expect(cancel.defaultPrevented).toBe(false);
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("keeps saved state for equivalent results but resets it and selections for a new draft", async () => {
    const view = render(button());
    const user = await openDialog();
    await user.click(screen.getByRole("checkbox", { name: "Build a demo" }));
    await user.click(screen.getByRole("button", { name: "Confirm save" }));
    view.rerender(button({ ...result }));
    expect(
      screen.getByRole("button", { name: "Saved to bucket" }),
    ).toBeDisabled();
    view.rerender(button({ ...result, refined_name: "Another draft" }));
    expect(
      screen.getByRole("button", { name: "Save to bucket" }),
    ).toBeEnabled();
    await user.click(screen.getByRole("button", { name: "Save to bucket" }));
    expect(
      screen.getByRole("checkbox", { name: "Build a demo" }),
    ).toBeChecked();
    expect(
      screen.getByRole("radio", { name: "Add selected ideas" }),
    ).toBeChecked();
    expect(screen.getByText("Another draft")).toBeInTheDocument();
  });
});
