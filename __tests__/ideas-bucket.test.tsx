import IdeasBucket from "@/app/main/ideas-bucket";
import { ToastContext } from "@/app/context/toast.provider";
import { render, screen, within } from "@testing-library/react";
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
    expect(screen.queryByText("Nested idea")).not.toBeInTheDocument();
    expect(screen.queryByText("Delete")).not.toBeInTheDocument();
  });

  it("opens full screen and closes again", async () => {
    const user = userEvent.setup();
    renderBucket();

    await user.click(screen.getByLabelText("button"));
    expect(
      screen.getByRole("dialog", { name: "Launch ideas" }),
    ).toBeInTheDocument();
    expect(document.body.style.overflow).toBe("hidden");

    await user.click(screen.getByLabelText("Close bucket"));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(document.body.style.overflow).toBe("");
  });

  it("minimizes the header summary and expands it again", async () => {
    const user = userEvent.setup();
    renderBucket(undefined, makeBucket({ description: "Full summary text" }));

    await user.click(screen.getByLabelText("button"));
    const dialog = within(screen.getByRole("dialog"));
    expect(dialog.getByText("Full summary text")).toBeVisible();

    await user.click(dialog.getByRole("button", { name: "Hide summary" }));
    expect(dialog.getByText("Full summary text")).not.toBeVisible();
    expect(dialog.queryByText(/^Updated/)).not.toBeInTheDocument();
    expect(dialog.getByText("Launch ideas")).toBeInTheDocument();
    expect(dialog.getByText("Delete")).toBeInTheDocument();

    await user.click(dialog.getByRole("button", { name: "Show summary" }));
    expect(dialog.getByText("Full summary text")).toBeVisible();
    expect(
      dialog.getByRole("button", { name: "Hide summary" }),
    ).toHaveAttribute("aria-expanded", "true");
  });

  describe("done ideas", () => {
    const mixed = [
      makeIdea({ id: 1, title: "Open one" }),
      makeIdea({ id: 2, title: "Finished one", status: "done" }),
      makeIdea({ id: 3, title: "Open two" }),
    ];

    it("shows a done count on the card", () => {
      renderBucket(mixed);
      expect(screen.getByText("1 of 3 done")).toBeInTheDocument();
    });

    it("hides the done count when nothing is done", () => {
      renderBucket();
      expect(screen.queryByText(/ done$/)).not.toBeInTheDocument();
    });

    it("moves done ideas into a collapsed section", async () => {
      const user = userEvent.setup();
      renderBucket(mixed);

      await user.click(screen.getByLabelText("button"));
      const dialog = within(screen.getByRole("dialog"));

      expect(dialog.getByText("Ideas 2")).toBeInTheDocument();
      expect(dialog.getByText("Open one")).toBeInTheDocument();
      expect(dialog.queryByText("Finished one")).not.toBeInTheDocument();

      await user.click(dialog.getByRole("button", { name: /Done 1/ }));
      expect(dialog.getByText("Finished one")).toBeInTheDocument();
    });

    it("pages through open ideas only", async () => {
      const user = userEvent.setup();
      renderBucket([
        ...Array.from({ length: 15 }, (_, i) =>
          makeIdea({ id: i + 1, title: `Idea ${i + 1}` }),
        ),
        makeIdea({ id: 99, title: "Old win", status: "done" }),
      ]);

      await user.click(screen.getByLabelText("button"));

      expect(screen.queryByLabelText("Next ideas")).not.toBeInTheDocument();
    });

    it("says so when everything is done", async () => {
      const user = userEvent.setup();
      renderBucket([makeIdea({ title: "Finished one", status: "done" })]);

      await user.click(screen.getByLabelText("button"));

      expect(
        screen.getByText(/Everything in here is done/),
      ).toBeInTheDocument();
    });
  });

  describe("gameplan tab", () => {
    const plan = {
      bucket_id: 10,
      bucket_name: "Launch ideas",
      finish_line: "A live waitlist page.",
      where_you_are: "Nothing built yet.",
      first_step: { title: "Pick a form tool", detail: "Ten minutes." },
      phases: [
        {
          title: "Build",
          goal: "Get it live",
          steps: [
            {
              title: "Ship it",
              detail: "One page.",
              idea_id: 1,
              effort: "low",
            },
          ],
        },
      ],
      cut: [],
      risks: [],
    };

    function routeFetch(saved: unknown) {
      vi.mocked(fetch).mockImplementation((async (url: string) => {
        if (url.startsWith("/api/buckets/gameplan")) {
          return { ok: true, json: async () => saved } as Response;
        }
        if (url === "/api/vault/analyze") {
          return new Response(JSON.stringify({ type: "done", data: plan }));
        }
        if (url === "/api/ideas/create") {
          return { ok: true, json: async () => [{ id: 55 }] } as Response;
        }
        return { ok: true, json: async () => [] } as Response;
      }) as never);
    }

    it("shows the bucket's latest saved gameplan with live done checks", async () => {
      routeFetch({ id: 3, createdAt: "2026-10-21T00:00:00.000Z", data: plan });
      const user = userEvent.setup();
      renderBucket([
        makeIdea({ id: 1, title: "Waitlist page", status: "done" }),
      ]);

      await user.click(screen.getByLabelText("button"));

      expect(
        await screen.findByText("A live waitlist page."),
      ).toBeInTheDocument();
      expect(screen.getByText("Ship it").className).toContain("line-through");
      expect(screen.getByRole("link", { name: "open" })).toHaveAttribute(
        "href",
        "/main/analysis/3",
      );

      // Checking the step off reopens or completes its idea.
      await user.click(
        screen.getByRole("button", { name: 'Mark "Ship it" not done' }),
      );
      expect(fetch).toHaveBeenCalledWith("/api/ideas/status", {
        method: "POST",
        body: JSON.stringify({ ideaId: 1, done: false }),
      });
    });

    it("makes a gameplan for this bucket and saves it to the bucket", async () => {
      routeFetch(null);
      const user = userEvent.setup();
      renderBucket(refineIdeas);

      await user.click(screen.getByLabelText("button"));
      await user.click(
        await screen.findByRole("button", { name: "Make a gameplan" }),
      );

      // Gameplans take a note, not the refinement directions.
      expect(screen.getByLabelText("Gameplan note")).toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: /More marketable/ }),
      ).not.toBeInTheDocument();
      expect(screen.getByText("0 / 300")).toBeInTheDocument();
      await user.type(screen.getByLabelText("Gameplan note"), "weekends");
      expect(screen.getByText("8 / 300")).toBeInTheDocument();
      await user.click(
        screen.getByRole("button", { name: "Plan Launch ideas" }),
      );

      expect(fetch).toHaveBeenCalledWith("/api/vault/analyze", {
        method: "POST",
        body: JSON.stringify({
          pathway: "gameplan",
          bucketId: 10,
          note: "weekends",
        }),
      });

      await user.click(
        await screen.findByRole("button", { name: /Save to bucket/ }),
      );
      expect(
        screen.queryByRole("button", { name: /Show Reasoning/ }),
      ).not.toBeInTheDocument();
      expect(fetch).toHaveBeenCalledWith("/api/vault/save", {
        method: "POST",
        body: JSON.stringify({
          data: plan,
          analysisType: "gameplan",
          bucketId: 10,
        }),
      });
    });
    it("keeps steps added as ideas linked when the plan is saved", async () => {
      routeFetch(null);
      const user = userEvent.setup();
      renderBucket(refineIdeas);

      await user.click(screen.getByLabelText("button"));
      await user.click(
        await screen.findByRole("button", { name: "Make a gameplan" }),
      );
      await user.click(
        screen.getByRole("button", { name: "Plan Launch ideas" }),
      );
      // Only the first step is unlinked in this plan.
      const [modalAdd] = await screen.findAllByRole("button", {
        name: "Add as idea",
      });
      await user.click(modalAdd);
      // The phase step was already linked; now the first step is too.
      await vi.waitFor(() =>
        expect(screen.getAllByText("From your idea")).toHaveLength(2),
      );
      expect(
        screen.queryByRole("button", { name: "Add as idea" }),
      ).not.toBeInTheDocument();

      // The reply box counts toward its limit too.
      await user.type(screen.getByLabelText("Reply to this draft"), "shorter");
      expect(screen.getByText("7 / 300")).toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: /Save to bucket/ }));

      const saveCall = vi
        .mocked(fetch)
        .mock.calls.find(([url]) => url === "/api/vault/save");
      const body = JSON.parse(String(saveCall?.[1]?.body));
      expect(body.data.first_step.idea_id).toBe(55);
    });
  });

  it("shows an empty state for a bucket with no ideas", async () => {
    const user = userEvent.setup();
    renderBucket([]);

    await user.click(screen.getByLabelText("button"));

    expect(screen.getByText(/No ideas in here yet/)).toBeInTheDocument();
  });

  it("toasts an error and stays open when delete fails", async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: false } as Response);
    const user = userEvent.setup();
    renderBucket();

    await user.click(screen.getByLabelText("button"));
    await user.click(screen.getByText("Delete"));

    expect(setToasts).toHaveBeenCalledWith([
      { id: 10, message: "Error deleting bucket", type: "error" },
    ]);
    expect(setToasts).not.toHaveBeenCalledWith([
      expect.objectContaining({ type: "success" }),
    ]);
    expect(refresh).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
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

  it("shows a parked bucket faded with a Parked badge", () => {
    renderBucket();

    expect(screen.getByText("Parked")).toBeInTheDocument();
    expect(screen.getByLabelText("button").className).toContain("opacity-50");
  });

  it("shows an active bucket at full strength", () => {
    renderBucket(undefined, makeBucket({ activeSince: new Date() }));

    expect(screen.getByText("Working on")).toBeInTheDocument();
    expect(screen.queryByText("Parked")).not.toBeInTheDocument();
    expect(screen.getByLabelText("button").className).not.toContain(
      "opacity-50",
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
    await user.click(screen.getByRole("tab", { name: "Versions" }));

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
    await user.click(screen.getByRole("tab", { name: "Versions" }));
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
      Array.from({ length: 15 }, (_, i) =>
        makeIdea({ id: i + 1, title: `Idea ${i + 1}` }),
      ),
    );

    await user.click(screen.getByLabelText("button"));

    expect(screen.getByText("Idea 15")).toBeInTheDocument();
    expect(screen.queryByLabelText("Next ideas")).not.toBeInTheDocument();
  });

  it("pages through ideas fifteen at a time", async () => {
    const user = userEvent.setup();
    renderBucket(
      Array.from({ length: 40 }, (_, i) =>
        makeIdea({ id: i + 1, title: `Idea ${i + 1}` }),
      ),
    );

    await user.click(screen.getByLabelText("button"));

    expect(screen.getByText("Ideas 40")).toBeInTheDocument();
    expect(screen.getByText("1 / 3")).toBeInTheDocument();
    expect(screen.getByText("Idea 1")).toBeInTheDocument();
    expect(screen.getByText("Idea 15")).toBeInTheDocument();
    expect(screen.queryByText("Idea 16")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Previous ideas")).toBeDisabled();

    await user.click(screen.getByLabelText("Next ideas"));
    expect(screen.getByText("2 / 3")).toBeInTheDocument();
    expect(screen.queryByText("Idea 15")).not.toBeInTheDocument();
    expect(screen.getByText("Idea 16")).toBeInTheDocument();
    expect(screen.getByText("Idea 30")).toBeInTheDocument();

    await user.click(screen.getByLabelText("Next ideas"));
    expect(screen.getByText("3 / 3")).toBeInTheDocument();
    expect(screen.getByText("Idea 31")).toBeInTheDocument();
    expect(screen.getByText("Idea 40")).toBeInTheDocument();
    expect(screen.queryByText("Idea 30")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Next ideas")).toBeDisabled();

    await user.click(screen.getByLabelText("Previous ideas"));
    expect(screen.getByText("2 / 3")).toBeInTheDocument();
    expect(screen.getByText("Idea 16")).toBeInTheDocument();
  });

  it("falls back to the last page when ideas on the current page are removed", async () => {
    const makeIdeas = (count: number) =>
      Array.from({ length: count }, (_, i) =>
        makeIdea({ id: i + 1, title: `Idea ${i + 1}` }),
      );
    const user = userEvent.setup();
    const { rerender } = renderBucket(makeIdeas(40));

    await user.click(screen.getByLabelText("button"));
    await user.click(screen.getByLabelText("Next ideas"));
    await user.click(screen.getByLabelText("Next ideas"));
    expect(screen.getByText("3 / 3")).toBeInTheDocument();

    // Deleting an idea refreshes the route, which re-renders with fewer ideas.
    rerender(
      <ToastContext.Provider value={{ toasts: [], setToasts }}>
        <IdeasBucket bucket={makeBucket()} ideas={makeIdeas(30)} />
      </ToastContext.Provider>,
    );

    expect(screen.getByText("2 / 2")).toBeInTheDocument();
    expect(screen.getByText("Idea 16")).toBeInTheDocument();
    expect(screen.getByText("Idea 30")).toBeInTheDocument();
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
    await user.click(screen.getByRole("tab", { name: "Versions" }));
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
