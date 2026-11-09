import NavLinks from "@/app/main/nav-links";
import TrashPage from "@/app/main/trash/page";
import { getDeletedIdeaBuckets } from "@/lib/api/buckets";
import { getSession } from "@/lib/auth";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeBucket, userId } from "./helpers";

const { pathname } = vi.hoisted(() => ({ pathname: vi.fn() }));
vi.mock("@/lib/api/buckets", () => ({ getDeletedIdeaBuckets: vi.fn() }));
vi.mock("@/lib/auth", () => ({ getSession: vi.fn() }));
vi.mock("next/navigation", () => ({ usePathname: pathname }));
vi.mock("@/app/components/restore-bucket-button", () => ({
  RestoreBucketButton: ({ bucketId }: { bucketId: number }) => (
    <button data-bucket-id={bucketId}>Restore</button>
  ),
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getSession).mockResolvedValue({ id: userId } as never);
  vi.mocked(getDeletedIdeaBuckets).mockResolvedValue([]);
  pathname.mockReturnValue("/main/trash");
});

describe("TrashPage", () => {
  it("returns null without a session and does not query buckets", async () => {
    vi.mocked(getSession).mockResolvedValue(null);

    expect(await TrashPage()).toBeNull();
    expect(getDeletedIdeaBuckets).not.toHaveBeenCalled();
  });

  it("shows an empty state, retention explanation, and Board link", async () => {
    render(await TrashPage());

    expect(getDeletedIdeaBuckets).toHaveBeenCalledWith(userId);
    expect(
      screen.getByRole("heading", { name: "Trash", level: 1 }),
    ).toBeInTheDocument();
    expect(screen.getByText(/ideas, versions, and analyses/)).toHaveTextContent(
      "Restored buckets return to the Board parked, with sharing off.",
    );
    expect(screen.getByText(/Trash is empty/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to Board" })).toHaveAttribute(
      "href",
      "/main",
    );
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("lists deleted buckets with details, deletion dates, and matching restore buttons", async () => {
    vi.mocked(getDeletedIdeaBuckets).mockResolvedValue([
      makeBucket({ deletedAt: new Date("2026-05-03T23:00:00.000Z") }),
      makeBucket({
        id: 11,
        name: "Old experiments",
        description: "",
        deletedAt: new Date("2026-04-02T00:00:00.000Z"),
      }),
    ]);

    render(await TrashPage());

    const items = within(
      screen.getByRole("list", { name: "Deleted buckets" }),
    ).getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(
      within(items[0]).getByRole("heading", { name: "Launch ideas" }),
    ).toBeInTheDocument();
    expect(
      within(items[0]).getByText("Things to try this month"),
    ).toBeInTheDocument();
    expect(within(items[0]).getByText("May 3, 2026")).toHaveAttribute(
      "datetime",
      "2026-05-03T23:00:00.000Z",
    );
    expect(
      within(items[0]).getByRole("button", { name: "Restore" }),
    ).toHaveAttribute("data-bucket-id", "10");
    expect(
      within(items[1]).getByRole("heading", { name: "Old experiments" }),
    ).toBeInTheDocument();
    expect(within(items[1]).getByText("April 2, 2026")).toBeInTheDocument();
    expect(
      within(items[1]).getByRole("button", { name: "Restore" }),
    ).toHaveAttribute("data-bucket-id", "11");
    expect(screen.getAllByRole("button")).toHaveLength(2);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(
      screen.queryByText(/permanent|delete forever/i),
    ).not.toBeInTheDocument();
  });
});

describe("Trash navigation", () => {
  it.each(["sidebar", "sheet"] as const)(
    "adds Trash as the third link in the %s with nested-route highlighting",
    async (variant) => {
      pathname.mockReturnValue("/main/trash/nested");
      const onNavigate = vi.fn();
      render(<NavLinks variant={variant} onNavigate={onNavigate} />);

      const links = screen.getAllByRole("link");
      expect(links.map((link) => link.textContent)).toEqual([
        "Board",
        "Analysis",
        "Trash",
      ]);
      expect(links[2]).toHaveAttribute("href", "/main/trash");
      expect(links[2]).toHaveAttribute("aria-current", "page");
      expect(links[0]).not.toHaveAttribute("aria-current");
      expect(links[1]).not.toHaveAttribute("aria-current");
      await userEvent.setup().click(links[2]);
      expect(onNavigate).toHaveBeenCalledOnce();
    },
  );

  it("does not highlight Trash on the Board", () => {
    pathname.mockReturnValue("/main");
    render(<NavLinks />);

    expect(screen.getByRole("link", { name: "Board" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: "Trash" })).not.toHaveAttribute(
      "aria-current",
    );
  });
});
