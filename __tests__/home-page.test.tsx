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

  it("passes where to go after signing in to every sign-in option", async () => {
    const { getByTestId, getAllByTestId } = render(
      await home({ next: "/share/tok" }),
    );

    expect(getByTestId("email-form")).toHaveAttribute(
      "data-next",
      "/share/tok",
    );
    for (const button of getAllByTestId("oauth")) {
      expect(button).toHaveAttribute("data-next", "/share/tok");
    }
  });

  it.each(["https://evil.com", "//evil.com", "/\\evil.com"])(
    "ignores an off-site destination %s",
    async (next) => {
      const { getByTestId } = render(await home({ next }));

      expect(getByTestId("email-form")).toHaveAttribute("data-next", "/main");
    },
  );
});
