import { getSession } from "@/lib/auth";
import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const redirect = vi.fn((url: string) => {
  throw new Error(`NEXT_REDIRECT ${url}`);
});

vi.mock("next/navigation", () => ({
  redirect: (url: string) => redirect(url),
}));
vi.mock("next/server", () => ({ connection: vi.fn() }));
vi.mock("next/font/google", () => ({
  Syne_Tactile: () => ({ className: "syne" }),
}));
vi.mock("@/lib/auth", () => ({ getSession: vi.fn() }));
vi.mock("@/app/components/email-auth-form", () => ({
  default: ({ next }: { next: string }) => (
    <div data-testid="email-form" data-next={next} />
  ),
}));
vi.mock("@/app/components/auth-button", () => ({
  default: ({ next }: { next: string }) => (
    <div data-testid="oauth" data-next={next} />
  ),
}));

import Home from "@/app/page";

function home(searchParams: Record<string, string> = {}) {
  return Home({
    params: Promise.resolve({}),
    searchParams: Promise.resolve(searchParams),
  } as never);
}

describe("landing page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getSession).mockResolvedValue(null);
  });

  it("sends a signed-in user to the board", async () => {
    vi.mocked(getSession).mockResolvedValue({ id: "user-1" } as never);

    await expect(home()).rejects.toThrow("NEXT_REDIRECT /main");
  });

  it("sends a signed-in user on to where they were headed", async () => {
    vi.mocked(getSession).mockResolvedValue({ id: "user-1" } as never);

    await expect(home({ next: "/share/tok" })).rejects.toThrow(
      "NEXT_REDIRECT /share/tok",
    );
  });

  it("links to the dedicated sign-in page and preserves the destination", async () => {
    const { getAllByRole, queryByTestId } = render(await home({ next: "/share/tok" }));
    expect(queryByTestId("email-form")).not.toBeInTheDocument();
    expect(queryByTestId("oauth")).not.toBeInTheDocument();
    for (const link of getAllByRole("link").filter((link) => link.textContent?.match(/Sign in|Find your next idea|Make room/))) {
      expect(link).toHaveAttribute("href", "/sign-in?next=%2Fshare%2Ftok");
    }
  });

  it.each(["https://evil.com", "//evil.com", "/\\evil.com"])(
    "ignores an off-site destination %s",
    async (next) => {
      const { getByRole } = render(await home({ next }));
      expect(getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/sign-in");
    },
  );
});
