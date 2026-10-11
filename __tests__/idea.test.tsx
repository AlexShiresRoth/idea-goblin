import Idea from "@/app/main/idea";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeIdea } from "./helpers";

const refresh = vi.fn();

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
});
