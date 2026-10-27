import { getSharedBucket } from "@/lib/api/buckets";
import { getSession } from "@/lib/auth";
import type { GameplanResult } from "@/lib/types";
import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const notFound = vi.fn(() => {
  throw new Error("NEXT_NOT_FOUND");
});

vi.mock("next/navigation", () => ({
  notFound: () => notFound(),
  useRouter: () => ({ refresh: vi.fn() }),
}));
vi.mock("next/font/google", () => ({
  Syne_Tactile: () => ({ className: "syne" }),
}));
vi.mock("@/lib/api/buckets", () => ({ getSharedBucket: vi.fn() }));
vi.mock("@/lib/auth", () => ({ getSession: vi.fn() }));

import SharedBucketPage, { generateMetadata } from "@/app/share/[token]/page";

const gameplan: GameplanResult = {
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
        { title: "Ship it", detail: "One page.", idea_id: 2, effort: "low" },
        {
          title: "Tell people",
          detail: "Post it.",
          idea_id: null,
          effort: "low",
        },
      ],
    },
  ],
  cut: [],
  risks: [],
};

function shared(
  overrides: Partial<Awaited<ReturnType<typeof getSharedBucket>>> = {},
) {
  return {
    ownerId: "owner-1",
    bucket: {
      name: "Launch ideas",
      description: "Things to try this month",
      theme: "growth",
      category: "music",
    },
    ideas: [
      {
        id: 1,
        title: "Waitlist form",
        description: "Collect emails.",
        category: "product",
        status: "incubating",
        type: "idea",
      },
      {
        id: 2,
        title: "Landing page",
        description: "One page.",
        category: "product",
        status: "done",
        type: "idea",
      },
    ],
    gameplan,
    ...overrides,
  };
}

const params = (token = "tok") => Promise.resolve({ token });

async function renderPage(token?: string) {
  render(await SharedBucketPage({ params: params(token) }));
}

describe("shared bucket page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getSharedBucket).mockResolvedValue(shared());
    vi.mocked(getSession).mockResolvedValue(null);
  });

  it("shows the bucket, its ideas and its gameplan, read-only", async () => {
    await renderPage("tok");

    expect(getSharedBucket).toHaveBeenCalledWith("tok");
    expect(
      screen.getByRole("heading", { level: 1, name: "Launch ideas" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Things to try this month")).toBeInTheDocument();
    expect(screen.getByText("growth")).toBeInTheDocument();

    const ideas = within(screen.getByRole("region", { name: "Ideas" }));
    expect(ideas.getByText("Waitlist form")).toBeInTheDocument();
    expect(ideas.getByText("Collect emails.")).toBeInTheDocument();
    expect(ideas.getByText("1 of 2 done")).toBeInTheDocument();
    expect(ideas.getByText("Landing page").className).toContain("line-through");

    const plan = within(screen.getByRole("region", { name: "Gameplan" }));
    expect(plan.getByText("A live waitlist page.")).toBeInTheDocument();
    expect(plan.getByText("From the idea: Landing page")).toBeInTheDocument();
    expect(plan.getByText("Ship it").className).toContain("line-through");

    // Nothing on the page changes the bucket.
    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });

  it("asks a signed-out visitor to sign in, then come back, to save a copy", async () => {
    await renderPage("tok");

    expect(
      screen.getByRole("link", { name: "Sign in to save a copy" }),
    ).toHaveAttribute("href", "/?next=%2Fshare%2Ftok");
  });

  it("lets a signed-in visitor save a copy", async () => {
    vi.mocked(getSession).mockResolvedValue({ id: "viewer-1" } as never);

    await renderPage("tok");

    expect(
      screen.getByRole("button", { name: "Save a copy" }),
    ).toBeInTheDocument();
  });

  it("tells the owner it's their bucket instead", async () => {
    vi.mocked(getSession).mockResolvedValue({ id: "owner-1" } as never);

    await renderPage("tok");

    expect(screen.getByText(/This is your bucket/)).toBeInTheDocument();
    expect(screen.queryByText(/save a copy/i)).not.toBeInTheDocument();
  });

  it("says when there's no gameplan or ideas", async () => {
    vi.mocked(getSharedBucket).mockResolvedValue(
      shared({ ideas: [], gameplan: null }),
    );

    await renderPage();

    expect(screen.getByText("No ideas in here yet.")).toBeInTheDocument();
    expect(screen.getByText("No gameplan yet.")).toBeInTheDocument();
  });

  it("404s for a token that isn't shared", async () => {
    vi.mocked(getSharedBucket).mockResolvedValue(null);

    await expect(renderPage("gone")).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("is titled after the bucket and kept out of search and referrers", async () => {
    const metadata = await generateMetadata({ params: params() });

    expect(metadata.title).toBe("Launch ideas");
    expect(metadata.robots).toMatchObject({ index: false, follow: false });
    expect(metadata.referrer).toBe("no-referrer");
  });

  it("has a generic title for a dead link", async () => {
    vi.mocked(getSharedBucket).mockResolvedValue(null);

    const metadata = await generateMetadata({ params: params() });

    expect(metadata.title).toBe("Shared bucket");
    expect(metadata.robots).toMatchObject({ index: false });
  });
});
