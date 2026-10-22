import { ExpandableSection } from "@/app/components/expandable-section";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

function renderSection(
  props: Partial<Parameters<typeof ExpandableSection>[0]> = {},
) {
  return render(
    <ExpandableSection title="Risks" {...props}>
      <p>Polishing forever</p>
    </ExpandableSection>,
  );
}

describe("ExpandableSection", () => {
  it("starts closed, showing the title, preview and leading content", () => {
    renderSection({
      preview: "Two things could sink this",
      leading: <span>!</span>,
    });

    expect(screen.getByRole("button", { name: /risks/i })).toBeInTheDocument();
    expect(screen.getByText("Two things could sink this")).toBeInTheDocument();
    expect(screen.getByText("!")).toBeInTheDocument();
    expect(screen.queryByText("Polishing forever")).not.toBeInTheDocument();
  });

  it("opens on click, hiding the preview and leading content", async () => {
    const user = userEvent.setup();
    renderSection({ preview: "Two things", leading: <span>!</span> });

    await user.click(screen.getByRole("button", { name: /risks/i }));

    expect(screen.getByText("Polishing forever")).toBeInTheDocument();
    expect(screen.queryByText("Two things")).not.toBeInTheDocument();
    expect(screen.queryByText("!")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Risks" })).toBeInTheDocument();
  });

  it("closes again on a second click", async () => {
    const user = userEvent.setup();
    renderSection({ preview: "Two things" });
    const toggle = screen.getByRole("button", { name: /risks/i });

    await user.click(toggle);
    await user.click(toggle);

    expect(screen.queryByText("Polishing forever")).not.toBeInTheDocument();
    expect(screen.getByText("Two things")).toBeInTheDocument();
  });

  it("starts open with defaultOpen and can be closed", async () => {
    const user = userEvent.setup();
    renderSection({ defaultOpen: true, preview: "Two things" });

    expect(screen.getByText("Polishing forever")).toBeInTheDocument();
    expect(screen.queryByText("Two things")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Risks" }));

    expect(screen.queryByText("Polishing forever")).not.toBeInTheDocument();
    expect(screen.getByText("Two things")).toBeInTheDocument();
  });

  it("shows only the title when closed without a preview", () => {
    renderSection();

    expect(screen.getByRole("button")).toHaveTextContent(/^Risks$/);
  });
});
