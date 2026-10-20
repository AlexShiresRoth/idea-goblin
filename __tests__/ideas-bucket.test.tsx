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

function renderBucket(
  ideas = [makeIdea({ title: "Nested idea" })],
  bucket = makeBucket(),
) {
  return render(
    <ToastContext.Provider value={{ toasts: [], setToasts }}>
      <IdeasBucket bucket={bucket} ideas={ideas} />
    </ToastContext.Provider>,
  );
}

const refineIdeas = [
  makeIdea({ id: 1, title: "First idea" }),
  makeIdea({ id: 2, title: "Second idea" }),
];

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

  it("shows the bucket's category icon", () => {
    renderBucket(undefined, makeBucket({ category: "music" }));

    expect(screen.getByTestId("bucket-icon")).toHaveAttribute(
      "data-category",
      "music",
    );
  });

  // Set on the outermost element so the container's border can use them,
  // not just the theme pill inside it.
  it("sets the category colors on the bucket container", () => {
    renderBucket(undefined, makeBucket({ category: "music" }));

    const container = screen.getByLabelText("button");
    expect(container.style.getPropertyValue("--bucket-primary")).toBe(
      "var(--color-fuchsia-400)",
    );
  });

  it("uses the default style for buckets without a category", () => {
    renderBucket();

    expect(screen.getByTestId("bucket-icon")).toHaveAttribute(
      "data-category",
      "default",
    );
  });

  it("expands to show ideas and delete", async () => {
    const user = userEvent.setup();
    renderBucket();

    await user.click(screen.getByLabelText("button"));

    expect(screen.getByText("Nested idea").closest(".hidden")).toBeNull();
    expect(screen.getByText("Delete")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add" })).toBeInTheDocument();
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
        message: 'Deleted "Launch ideas". Off to the rubbish heap.',
        type: "success",
      },
    ]);
    expect(refresh).toHaveBeenCalled();
  });

  it("opens refinement on this bucket, preselected", async () => {
    const user = userEvent.setup();
    renderBucket(refineIdeas);

    await user.click(screen.getByLabelText("button"));
    await user.click(screen.getByText("Refine"));

    expect(screen.getByText("Choose a bucket")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Refine Launch ideas" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Let Goblin recommend")).not.toBeInTheDocument();
  });

  it("refines the bucket", async () => {
    const user = userEvent.setup();
    renderBucket(refineIdeas);

    await user.click(screen.getByLabelText("button"));
    await user.click(screen.getByText("Refine"));
    await user.click(
      screen.getByRole("button", { name: "Refine Launch ideas" }),
    );

    expect(fetch).toHaveBeenCalledWith("/api/vault/analyze", {
      method: "POST",
      body: JSON.stringify({ pathway: "refinement", bucketId: 10, focus: [] }),
    });
  });

  it("sends the chosen refinement directions and note", async () => {
    const user = userEvent.setup();
    renderBucket(refineIdeas);

    await user.click(screen.getByLabelText("button"));
    await user.click(screen.getByText("Refine"));
    await user.click(screen.getByRole("button", { name: /More marketable/ }));
    await user.click(screen.getByRole("button", { name: /More concise/ }));
    await user.click(screen.getByRole("button", { name: /More concise/ }));
    await user.click(screen.getByRole("button", { name: /Bigger vision/ }));
    await user.type(
      screen.getByLabelText("Refinement note"),
      "  for teachers ",
    );
    await user.click(
      screen.getByRole("button", { name: "Refine Launch ideas" }),
    );

    expect(fetch).toHaveBeenCalledWith("/api/vault/analyze", {
      method: "POST",
      body: JSON.stringify({
        pathway: "refinement",
        bucketId: 10,
        focus: ["marketable", "ambitious"],
        note: "for teachers",
      }),
    });
  });

  it("shows a loading indicator while versions load", async () => {
    vi.mocked(fetch).mockReturnValue(new Promise(() => {}));
    const user = userEvent.setup();
    renderBucket();

    await user.click(screen.getByLabelText("button"));

    expect(screen.getByText("Digging up old versions...")).toBeInTheDocument();
  });

  it("lists saved versions and restores one", async () => {
    const version = {
      id: 4,
      bucketId: 10,
      name: "Older name",
      description: "Older description",
      theme: "growth",
      ideas: [
        {
          id: 1,
          title: "Old idea",
          description: "d",
          category: "c",
          status: "incubating",
          type: "idea",
        },
      ],
      createdAt: "2026-01-01T00:00:00.000Z",
    };
    vi.mocked(fetch).mockImplementation(async (url) => {
      const body = String(url).startsWith("/api/buckets/versions?")
        ? [version]
        : { message: "Version restored" };
      return { ok: true, json: async () => body } as Response;
    });
    const user = userEvent.setup();
    renderBucket();

    await user.click(screen.getByLabelText("button"));
    expect(await screen.findByText("Older name")).toBeInTheDocument();
    expect(screen.queryByText("Old idea")).not.toBeInTheDocument();

    await user.click(screen.getByTestId("toggle-version"));
    expect(screen.getByTestId("toggle-version")).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    expect(screen.getByText("Old idea")).toBeInTheDocument();
    expect(screen.getByText("Older description")).toBeInTheDocument();

    await user.click(screen.getByTestId("restore-version"));

    expect(fetch).toHaveBeenCalledWith("/api/buckets/versions/restore", {
      method: "POST",
      body: JSON.stringify({ versionId: 4 }),
    });
    expect(refresh).toHaveBeenCalled();
  });

  it("closes the picker on cancel", async () => {
    const user = userEvent.setup();
    renderBucket(refineIdeas);

    await user.click(screen.getByLabelText("button"));
    await user.click(screen.getByText("Refine"));
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.queryByText("Choose a bucket")).not.toBeInTheDocument();
  });

  it("hides pagination when the bucket fits on one page", async () => {
    const user = userEvent.setup();
    renderBucket(
      Array.from({ length: 5 }, (_, i) =>
        makeIdea({ id: i + 1, title: `Idea ${i + 1}` }),
      ),
    );

    await user.click(screen.getByLabelText("button"));

    expect(screen.getByText("Idea 5")).toBeInTheDocument();
    expect(screen.queryByLabelText("Next ideas")).not.toBeInTheDocument();
  });

  it("pages through ideas five at a time", async () => {
    const user = userEvent.setup();
    renderBucket(
      Array.from({ length: 12 }, (_, i) =>
        makeIdea({ id: i + 1, title: `Idea ${i + 1}` }),
      ),
    );

    await user.click(screen.getByLabelText("button"));

    expect(screen.getByText("Ideas 12")).toBeInTheDocument();
    expect(screen.getByText("1 / 3")).toBeInTheDocument();
    expect(screen.getByText("Idea 1")).toBeInTheDocument();
    expect(screen.getByText("Idea 5")).toBeInTheDocument();
    expect(screen.queryByText("Idea 6")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Previous ideas")).toBeDisabled();

    await user.click(screen.getByLabelText("Next ideas"));
    expect(screen.getByText("2 / 3")).toBeInTheDocument();
    expect(screen.queryByText("Idea 5")).not.toBeInTheDocument();
    expect(screen.getByText("Idea 6")).toBeInTheDocument();
    expect(screen.getByText("Idea 10")).toBeInTheDocument();

    await user.click(screen.getByLabelText("Next ideas"));
    expect(screen.getByText("3 / 3")).toBeInTheDocument();
    expect(screen.getByText("Idea 11")).toBeInTheDocument();
    expect(screen.getByText("Idea 12")).toBeInTheDocument();
    expect(screen.queryByText("Idea 10")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Next ideas")).toBeDisabled();

    await user.click(screen.getByLabelText("Previous ideas"));
    expect(screen.getByText("2 / 3")).toBeInTheDocument();
    expect(screen.getByText("Idea 6")).toBeInTheDocument();
  });

  it("falls back to the last page when ideas on the current page are removed", async () => {
    const makeIdeas = (count: number) =>
      Array.from({ length: count }, (_, i) =>
        makeIdea({ id: i + 1, title: `Idea ${i + 1}` }),
      );
    const user = userEvent.setup();
    const { rerender } = renderBucket(makeIdeas(12));

    await user.click(screen.getByLabelText("button"));
    await user.click(screen.getByLabelText("Next ideas"));
    await user.click(screen.getByLabelText("Next ideas"));
    expect(screen.getByText("3 / 3")).toBeInTheDocument();

    // Deleting an idea refreshes the route, which re-renders with fewer ideas.
    rerender(
      <ToastContext.Provider value={{ toasts: [], setToasts }}>
        <IdeasBucket bucket={makeBucket()} ideas={makeIdeas(10)} />
      </ToastContext.Provider>,
    );

    expect(screen.getByText("2 / 2")).toBeInTheDocument();
    expect(screen.getByText("Idea 6")).toBeInTheDocument();
    expect(screen.getByText("Idea 10")).toBeInTheDocument();
    expect(screen.getByLabelText("Next ideas")).toBeDisabled();
  });

  it("collapses version details again on a second toggle", async () => {
    const versions = [1, 2].map((id) => ({
      id,
      bucketId: 10,
      name: `Version ${id}`,
      description: `Description ${id}`,
      theme: "growth",
      ideas: [],
      createdAt: "2026-01-01T00:00:00.000Z",
    }));
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => versions,
    } as Response);
    const user = userEvent.setup();
    renderBucket();

    await user.click(screen.getByLabelText("button"));
    await screen.findByText("Version 1");
    const [first, second] = screen.getAllByTestId("toggle-version");

    await user.click(first);
    expect(screen.getByText("Description 1")).toBeInTheDocument();
    expect(screen.queryByText("Description 2")).not.toBeInTheDocument();
    expect(second).toHaveAttribute("aria-expanded", "false");

    await user.click(second);
    expect(screen.getByText("Description 2")).toBeInTheDocument();
    expect(screen.getByText("Description 1")).toBeInTheDocument();

    await user.click(first);
    expect(first).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("Description 1")).not.toBeInTheDocument();
    expect(screen.getByText("Description 2")).toBeInTheDocument();
  });

  it("disables refine when the bucket has no ideas", async () => {
    const user = userEvent.setup();
    renderBucket([]);

    await user.click(screen.getByLabelText("button"));

    expect(screen.getByText("Refine").closest("button")).toBeDisabled();
  });
});
