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

function renderModal() {
  render(
    <ToastContext.Provider value={{ toasts: [], setToasts: vi.fn() }}>
      <CreateIdeaModal type="inline" />
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
