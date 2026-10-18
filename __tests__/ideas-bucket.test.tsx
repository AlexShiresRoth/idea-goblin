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

function renderBucket(ideas = [makeIdea({ title: "Nested idea" })]) {
  return render(
    <ToastContext.Provider value={{ toasts: [], setToasts }}>
      <IdeasBucket bucket={makeBucket()} ideas={ideas} />
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
    await user.type(screen.getByLabelText("Refinement note"), "  for teachers ");
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
    expect(screen.getByText("Old idea")).toBeInTheDocument();

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

  it("disables refine when the bucket has no ideas", async () => {
    const user = userEvent.setup();
    renderBucket([]);

    await user.click(screen.getByLabelText("button"));

    expect(screen.getByText("Refine").closest("button")).toBeDisabled();
  });
});
