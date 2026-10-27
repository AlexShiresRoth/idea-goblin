import BackButton from "@/app/main/back-button";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const usePathname = vi.fn();

vi.mock("next/navigation", () => ({
  usePathname: () => usePathname(),
}));

describe("BackButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("is hidden on the board", () => {
    usePathname.mockReturnValue("/main");
    render(<BackButton />);

    expect(screen.queryByTestId("back-button")).not.toBeInTheDocument();
  });

  it("goes back to the board from a bucket", () => {
    usePathname.mockReturnValue("/main/buckets/abc");
    render(<BackButton />);

    expect(screen.getByRole("link", { name: "Back to board" })).toHaveAttribute(
      "href",
      "/main",
    );
  });

  it("goes back to the board from the analysis list", () => {
    usePathname.mockReturnValue("/main/analysis");
    render(<BackButton />);

    expect(screen.getByRole("link", { name: "Back to board" })).toHaveAttribute(
      "href",
      "/main",
    );
  });

  it("goes back to the analysis list from an analysis", () => {
    usePathname.mockReturnValue("/main/analysis/123");
    render(<BackButton />);

    expect(
      screen.getByRole("link", { name: "Back to analysis" }),
    ).toHaveAttribute("href", "/main/analysis");
  });
});
