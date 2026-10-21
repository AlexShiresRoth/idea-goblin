import Idea from "@/app/main/idea";
import { ToastContext } from "@/app/context/toast.provider";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeIdea } from "./helpers";

const refresh = vi.fn();
const setToasts = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
}));

describe("Idea", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ message: "Idea deleted successfully" }),
      }),
    );
  });

  it("shows the title and hides the description until expanded", () => {
    render(<Idea idea={makeIdea()} />);

    expect(screen.getByText("Ship a landing page")).toBeInTheDocument();
    expect(
      screen.queryByText("A simple page to collect emails."),
    ).not.toBeInTheDocument();
    expect(screen.queryByTestId("delete-idea")).not.toBeInTheDocument();
  });

  it("expands to show the description and actions", async () => {
    const user = userEvent.setup();
    render(<Idea idea={makeIdea()} />);

    await user.click(screen.getByTestId("toggle-expanded"));

    expect(
      screen.getByText("A simple page to collect emails."),
    ).toBeInTheDocument();
    expect(screen.getByTestId("delete-idea")).toBeInTheDocument();
    expect(screen.getByTestId("edit-idea")).toBeInTheDocument();
  });

  it("deletes the idea and refreshes the page", async () => {
    const user = userEvent.setup();
    render(<Idea idea={makeIdea({ id: 7 })} />);

    await user.click(screen.getByTestId("toggle-expanded"));
    await user.click(screen.getByTestId("delete-idea"));

    expect(fetch).toHaveBeenCalledWith("/api/ideas/delete", {
      method: "DELETE",
      body: JSON.stringify({ ideaId: 7 }),
    });
    expect(refresh).toHaveBeenCalled();
  });

  it("toasts an error instead of success when delete fails", async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: false } as Response);
    const user = userEvent.setup();
    render(
      <ToastContext.Provider value={{ toasts: [], setToasts }}>
        <Idea idea={makeIdea({ id: 7 })} />
      </ToastContext.Provider>,
    );

    await user.click(screen.getByTestId("toggle-expanded"));
    await user.click(screen.getByTestId("delete-idea"));

    expect(setToasts).toHaveBeenCalledWith([
      { id: 7, message: "Failed to delete idea", type: "error" },
    ]);
    expect(setToasts).not.toHaveBeenCalledWith([
      expect.objectContaining({ type: "success" }),
    ]);
    expect(refresh).not.toHaveBeenCalled();
  });

  describe("done", () => {
    function renderIdea(status = "incubating") {
      render(
        <ToastContext.Provider value={{ toasts: [], setToasts }}>
          <Idea idea={makeIdea({ id: 7, status })} />
        </ToastContext.Provider>,
      );
    }

    it("marks an open idea done", async () => {
      const user = userEvent.setup();
      renderIdea();

      await user.click(screen.getByTestId("toggle-expanded"));
      expect(screen.getByTestId("toggle-done")).toHaveTextContent("Done");
      await user.click(screen.getByTestId("toggle-done"));

      expect(fetch).toHaveBeenCalledWith("/api/ideas/status", {
        method: "POST",
        body: JSON.stringify({ ideaId: 7, done: true }),
      });
      expect(refresh).toHaveBeenCalled();
    });

    it("shows a done idea as done and reopens it", async () => {
      const user = userEvent.setup();
      renderIdea("done");

      expect(screen.getByLabelText("Done")).toBeInTheDocument();
      expect(screen.getByText("Ship a landing page").className).toContain(
        "line-through",
      );

      await user.click(screen.getByTestId("toggle-expanded"));
      expect(screen.getByTestId("toggle-done")).toHaveTextContent("Not done");
      await user.click(screen.getByTestId("toggle-done"));

      expect(fetch).toHaveBeenCalledWith("/api/ideas/status", {
        method: "POST",
        body: JSON.stringify({ ideaId: 7, done: false }),
      });
    });

    it("toasts an error when marking fails", async () => {
      vi.mocked(fetch).mockResolvedValue({ ok: false } as Response);
      const user = userEvent.setup();
      renderIdea();

      await user.click(screen.getByTestId("toggle-expanded"));
      await user.click(screen.getByTestId("toggle-done"));

      expect(setToasts).toHaveBeenCalledWith([
        { id: 7, message: "Failed to update idea", type: "error" },
      ]);
      expect(refresh).not.toHaveBeenCalled();
    });
  });

  describe("editing", () => {
    function renderIdea() {
      render(
        <ToastContext.Provider value={{ toasts: [], setToasts }}>
          <Idea idea={makeIdea({ id: 7 })} />
        </ToastContext.Provider>,
      );
    }

    async function openEditor() {
      const user = userEvent.setup();
      renderIdea();
      await user.click(screen.getByTestId("toggle-expanded"));
      await user.click(screen.getByTestId("edit-idea"));
      return user;
    }

    it("fills the form with the idea's current text", async () => {
      await openEditor();

      expect(screen.getByLabelText("Idea title")).toHaveValue(
        "Ship a landing page",
      );
      expect(screen.getByLabelText("Idea description")).toHaveValue(
        "A simple page to collect emails.",
      );
      expect(screen.queryByTestId("delete-idea")).not.toBeInTheDocument();
    });

    it("saves the edits and refreshes", async () => {
      const user = await openEditor();

      await user.clear(screen.getByLabelText("Idea title"));
      await user.type(screen.getByLabelText("Idea title"), "Ship a waitlist");
      await user.click(screen.getByRole("button", { name: "Save" }));

      expect(fetch).toHaveBeenCalledWith("/api/ideas/update", {
        method: "POST",
        body: JSON.stringify({
          ideaId: 7,
          title: "Ship a waitlist",
          description: "A simple page to collect emails.",
        }),
      });
      await waitFor(() => expect(refresh).toHaveBeenCalled());
      expect(screen.queryByLabelText("Idea title")).not.toBeInTheDocument();
    });

    it("keeps the form open when saving fails", async () => {
      vi.mocked(fetch).mockResolvedValue({ ok: false } as Response);
      const user = await openEditor();

      await user.click(screen.getByRole("button", { name: "Save" }));

      await waitFor(() =>
        expect(setToasts).toHaveBeenCalledWith([
          expect.objectContaining({ type: "error" }),
        ]),
      );
      expect(screen.getByLabelText("Idea title")).toBeInTheDocument();
      expect(refresh).not.toHaveBeenCalled();
    });

    it("cancels without saving", async () => {
      const user = await openEditor();

      await user.type(screen.getByLabelText("Idea title"), " draft");
      await user.click(screen.getByRole("button", { name: "Cancel" }));

      expect(fetch).not.toHaveBeenCalled();
      expect(screen.getByText("Ship a landing page")).toBeInTheDocument();
    });
  });
});
