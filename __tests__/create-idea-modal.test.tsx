import CreateIdeaModal from "@/app/components/create-idea-modal";
import { ToastContext } from "@/app/context/toast.provider";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/main",
}));

const fetchMock = vi.fn();

function renderModal(modal = <CreateIdeaModal type="inline" />) {
  render(
    <ToastContext.Provider value={{ toasts: [], setToasts: vi.fn() }}>
      {modal}
    </ToastContext.Provider>,
  );
}

function sentBody() {
  const call = fetchMock.mock.calls.find(([url]) => url === "/api/ideas/create");
  return JSON.parse(call![1].body);
}

describe("CreateIdeaModal bucket choice", () => {
  beforeEach(() => {
    fetchMock.mockImplementation(async (url: string) =>
      url === "/api/buckets/list"
        ? new Response(
            JSON.stringify([{ id: 9, name: "Dungeon game", theme: "Game" }]),
          )
        : new Response("[]"),
    );
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    fetchMock.mockReset();
  });

  async function openAndDescribe() {
    const user = userEvent.setup();
    renderModal();
    await user.click(screen.getByRole("button", { name: /new idea/i }));
    await user.type(screen.getByLabelText(/what's your idea/i), "Loot respec");
    await screen.findByRole("option", { name: "Dungeon game" });
    return user;
  }

  it("lets the Goblin decide by default", async () => {
    const user = await openAndDescribe();

    await user.click(screen.getByRole("button", { name: /create idea/i }));

    await waitFor(() =>
      expect(sentBody()).toEqual({ description: "Loot respec", bucket: "auto" }),
    );
  });

  it("sends an existing bucket id", async () => {
    const user = await openAndDescribe();

    await user.selectOptions(screen.getByLabelText("Bucket"), "Dungeon game");
    await user.click(screen.getByRole("button", { name: /create idea/i }));

    await waitFor(() => expect(sentBody().bucket).toBe(9));
  });

  it("preselects the bucket it was opened from", async () => {
    const user = userEvent.setup();
    renderModal(<CreateIdeaModal type="bucket" defaultBucket={9} />);
    await user.click(screen.getByRole("button", { name: "Add" }));
    await user.type(screen.getByLabelText(/what's your idea/i), "Loot respec");
    await screen.findByRole("option", { name: "Dungeon game" });

    expect(screen.getByLabelText("Bucket")).toHaveValue("9");
    await user.click(screen.getByRole("button", { name: /create idea/i }));

    await waitFor(() => expect(sentBody().bucket).toBe(9));
  });

  it("sends a new bucket with its name", async () => {
    const user = await openAndDescribe();

    expect(screen.queryByLabelText("New bucket name")).not.toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText("Bucket"), "New bucket");
    await user.type(screen.getByLabelText("New bucket name"), "Side quests");
    await user.click(screen.getByRole("button", { name: /create idea/i }));

    await waitFor(() =>
      expect(sentBody()).toEqual({
        description: "Loot respec",
        bucket: "new",
        bucketName: "Side quests",
      }),
    );
  });
});

describe("CreateIdeaModal with several ideas", () => {
  const setToasts = vi.fn();
  let importResponse: () => Response;

  function streamed(...events: object[]) {
    return new Response(
      events.map((event) => JSON.stringify(event)).join("\n") + "\n",
    );
  }

  beforeEach(() => {
    importResponse = () =>
      streamed({
        type: "done",
        data: { created: 2, buckets: [], skipped: [] },
      });
    fetchMock.mockImplementation(async (url: string) => {
      if (url === "/api/buckets/list") {
        return new Response(
          JSON.stringify([{ id: 9, name: "Dungeon game", theme: "Game" }]),
        );
      }
      if (url === "/api/ideas/import") return importResponse();
      return new Response("[]");
    });
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    fetchMock.mockReset();
    setToasts.mockReset();
  });

  async function open() {
    const user = userEvent.setup();
    render(
      <ToastContext.Provider value={{ toasts: [], setToasts }}>
        <CreateIdeaModal type="inline" />
      </ToastContext.Provider>,
    );
    await user.click(screen.getByRole("button", { name: /new idea/i }));
    await screen.findByRole("option", { name: "Dungeon game" });
    return user;
  }

  function bodyFor(url: string) {
    const call = fetchMock.mock.calls.find(([called]) => called === url);
    return call ? JSON.parse(call[1].body) : undefined;
  }

  it("sends an optional title with a single idea", async () => {
    const user = await open();

    await user.type(screen.getByLabelText("Title (optional)"), "Loot respec");
    await user.type(
      screen.getByLabelText(/what's your idea/i),
      "Let players reset skills",
    );
    await user.click(screen.getByRole("button", { name: /create idea/i }));

    await waitFor(() =>
      expect(bodyFor("/api/ideas/create")).toEqual({
        description: "Let players reset skills",
        title: "Loot respec",
        bucket: "auto",
      }),
    );
  });

  it("adds several ideas in one batched request, keeping lookalikes", async () => {
    const user = await open();

    await user.type(screen.getByLabelText("Title (optional)"), "Loot respec");
    await user.type(screen.getByLabelText(/what's your idea/i), "Reset skills");
    await user.click(screen.getByRole("button", { name: "Add another idea" }));
    await user.type(
      screen.getByLabelText("Idea 2 description"),
      "A daily dungeon",
    );
    await user.click(screen.getByRole("button", { name: "Create 2 ideas" }));

    await waitFor(() =>
      expect(bodyFor("/api/ideas/import")).toEqual({
        rows: [
          {
            title: "Loot respec",
            description: "Reset skills",
            target: { type: "auto" },
          },
          { description: "A daily dungeon", target: { type: "auto" } },
        ],
        allowDuplicates: true,
      }),
    );
    expect(bodyFor("/api/ideas/create")).toBeUndefined();
    await waitFor(() =>
      expect(setToasts).toHaveBeenCalledWith([
        expect.objectContaining({
          message: "Added 2 ideas to the hoard",
          type: "success",
        }),
      ]),
    );
    expect(
      screen.queryByLabelText(/what's your idea/i),
    ).not.toBeInTheDocument();
  });

  it("puts several ideas in a chosen bucket", async () => {
    const user = await open();

    await user.type(screen.getByLabelText(/what's your idea/i), "Reset skills");
    await user.click(screen.getByRole("button", { name: "Add another idea" }));
    await user.type(
      screen.getByLabelText("Idea 2 description"),
      "A daily dungeon",
    );
    await user.selectOptions(screen.getByLabelText("Bucket"), "Dungeon game");
    await user.click(screen.getByRole("button", { name: "Create 2 ideas" }));

    await waitFor(() =>
      expect(
        bodyFor("/api/ideas/import").rows.map(
          (row: { target: unknown }) => row.target,
        ),
      ).toEqual([
        { type: "existing", bucketId: 9 },
        { type: "existing", bucketId: 9 },
      ]),
    );
  });

  it("needs a name for a new bucket holding several ideas", async () => {
    const user = await open();

    await user.type(screen.getByLabelText(/what's your idea/i), "Reset skills");
    await user.click(screen.getByRole("button", { name: "Add another idea" }));
    await user.type(
      screen.getByLabelText("Idea 2 description"),
      "A daily dungeon",
    );
    await user.selectOptions(screen.getByLabelText("Bucket"), "New bucket");

    const create = screen.getByRole("button", { name: "Create 2 ideas" });
    expect(create).toBeDisabled();
    await user.type(screen.getByLabelText("New bucket name"), "Side quests");
    expect(create).toBeEnabled();
    await user.click(create);

    await waitFor(() =>
      expect(bodyFor("/api/ideas/import").rows[0].target).toEqual({
        type: "named",
        name: "Side quests",
      }),
    );
  });

  it("ignores empty extra rows and removes rows", async () => {
    const user = await open();

    await user.type(screen.getByLabelText(/what's your idea/i), "Reset skills");
    await user.click(screen.getByRole("button", { name: "Add another idea" }));
    await user.click(screen.getByRole("button", { name: "Add another idea" }));
    await user.type(screen.getByLabelText("Idea 3 description"), "Dungeon");
    await user.click(screen.getByRole("button", { name: "Remove idea 3" }));

    expect(
      screen.queryByLabelText("Idea 3 description"),
    ).not.toBeInTheDocument();
    // Row 2 is empty, so this is a single idea again.
    await user.click(screen.getByRole("button", { name: /create idea/i }));

    await waitFor(() =>
      expect(bodyFor("/api/ideas/create")).toEqual({
        description: "Reset skills",
        bucket: "auto",
      }),
    );
  });

  it("asks for a description on every idea", async () => {
    const user = await open();

    await user.type(screen.getByLabelText(/what's your idea/i), "Reset skills");
    await user.click(screen.getByRole("button", { name: "Add another idea" }));
    await user.type(
      screen.getByLabelText("Idea 2 title (optional)"),
      "Only a title",
    );
    await user.click(screen.getByRole("button", { name: "Create 2 ideas" }));

    expect(setToasts).toHaveBeenCalledWith([
      expect.objectContaining({ message: "Each idea needs a description" }),
    ]);
    expect(bodyFor("/api/ideas/import")).toBeUndefined();
  });

  it("caps the form at ten ideas and points to Import", async () => {
    const user = await open();

    for (let i = 0; i < 9; i += 1) {
      await user.click(
        screen.getByRole("button", { name: "Add another idea" }),
      );
    }

    expect(screen.getByLabelText("Idea 10 description")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Add another idea" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText(/For longer lists, use Import/),
    ).toBeInTheDocument();
  });

  it("keeps everything typed when saving fails", async () => {
    importResponse = () =>
      streamed({ type: "error", message: "Nothing was saved." });
    const user = await open();

    await user.type(screen.getByLabelText(/what's your idea/i), "Reset skills");
    await user.click(screen.getByRole("button", { name: "Add another idea" }));
    await user.type(
      screen.getByLabelText("Idea 2 description"),
      "A daily dungeon",
    );
    await user.click(screen.getByRole("button", { name: "Create 2 ideas" }));

    await waitFor(() =>
      expect(setToasts).toHaveBeenCalledWith([
        expect.objectContaining({
          message: "Failed to create ideas",
          type: "error",
        }),
      ]),
    );
    expect(screen.getByLabelText("Idea 2 description")).toHaveValue(
      "A daily dungeon",
    );
  });

  it("shows the rate limit message", async () => {
    importResponse = () =>
      new Response("The Goblin needs a break: 5 imports per 60 minutes.", {
        status: 429,
      });
    const user = await open();

    await user.type(screen.getByLabelText(/what's your idea/i), "Reset skills");
    await user.click(screen.getByRole("button", { name: "Add another idea" }));
    await user.type(
      screen.getByLabelText("Idea 2 description"),
      "A daily dungeon",
    );
    await user.click(screen.getByRole("button", { name: "Create 2 ideas" }));

    await waitFor(() =>
      expect(setToasts).toHaveBeenCalledWith([
        expect.objectContaining({
          message: "The Goblin needs a break: 5 imports per 60 minutes.",
        }),
      ]),
    );
  });
});
