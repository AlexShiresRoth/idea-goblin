import ImportIdeasModal from "@/app/components/import-ideas-modal";
import type { ImportSummary } from "@/lib/import/schema";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const refresh = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
}));

const buckets = [
  { id: 10, name: "Launch ideas", description: "d", theme: "growth" },
  { id: 11, name: "Games", description: "d", theme: "fun" },
];

function streamed(...events: object[]) {
  return new Response(events.map((event) => JSON.stringify(event)).join("\n"));
}

function done(summary: Partial<ImportSummary> = {}) {
  return {
    type: "done",
    data: { created: 2, buckets: [], skipped: [], ...summary },
  };
}

let importResponses: Response[] = [];

function importBodies() {
  return vi
    .mocked(fetch)
    .mock.calls.filter(([url]) => url === "/api/ideas/import")
    .map(([, init]) => JSON.parse(String(init?.body)));
}

async function openAndPaste(text: string, props = {}) {
  const user = userEvent.setup();
  render(<ImportIdeasModal type="inline" {...props} />);
  await user.click(screen.getByRole("button", { name: /Import/ }));
  await user.type(screen.getByLabelText("Ideas to import"), text);
  await user.click(screen.getByRole("button", { name: "Preview" }));
  return user;
}

describe("ImportIdeasModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    importResponses = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url === "/api/buckets/list") {
          return { ok: true, json: async () => buckets } as Response;
        }
        return importResponses.shift() ?? streamed(done());
      }),
    );
  });

  it("previews a pasted list and imports it for Goblin to sort", async () => {
    importResponses.push(
      streamed(
        { type: "status", step: "context", message: "Read 2 ideas" },
        done({
          buckets: [{ id: 12, name: "Pet tech", created: true, count: 2 }],
        }),
      ),
    );
    const user = await openAndPaste(
      "- Smart dog bowl{enter}- Cat GPS collar{enter}- smart dog bowl",
    );

    expect(screen.getAllByTestId("import-row")).toHaveLength(3);
    expect(screen.getByText("Same as line 1")).toBeInTheDocument();
    expect(screen.getByLabelText("Include line 3")).not.toBeChecked();

    await user.click(screen.getByRole("button", { name: "Import 2 ideas" }));

    expect(importBodies()).toEqual([
      {
        rows: [
          { description: "Smart dog bowl", target: { type: "auto" } },
          { description: "Cat GPS collar", target: { type: "auto" } },
        ],
        allowDuplicates: false,
      },
    ]);
    expect(
      await screen.findByText("Added 2 ideas to the hoard."),
    ).toBeInTheDocument();
    expect(screen.getByText(/Pet tech: 2 ideas/)).toBeInTheDocument();
    expect(screen.getByText("new bucket")).toBeInTheDocument();
    expect(refresh).toHaveBeenCalled();
  });

  it("puts everything in one new bucket once it has a name", async () => {
    const user = await openAndPaste("First idea here");

    await user.selectOptions(
      screen.getByLabelText("Where should they go?"),
      "one",
    );
    const importButton = screen.getByRole("button", { name: "Import 1 idea" });
    expect(importButton).toBeDisabled();

    await user.type(screen.getByLabelText("New bucket name"), "Side quests");
    await user.click(importButton);

    expect(importBodies()[0].rows).toEqual([
      {
        description: "First idea here",
        target: { type: "named", name: "Side quests" },
      },
    ]);
  });

  it("sends an optional description for the new bucket", async () => {
    const user = await openAndPaste("First idea here{enter}Second idea here");

    await user.selectOptions(
      screen.getByLabelText("Where should they go?"),
      "one",
    );
    await user.type(screen.getByLabelText("New bucket name"), "Side quests");
    await user.type(
      screen.getByLabelText("New bucket description"),
      "Things to tinker with",
    );
    await user.click(screen.getByRole("button", { name: "Import 2 ideas" }));

    expect(
      importBodies()[0].rows.map((row: { target: unknown }) => row.target),
    ).toEqual([
      {
        type: "named",
        name: "Side quests",
        description: "Things to tinker with",
      },
      {
        type: "named",
        name: "Side quests",
        description: "Things to tinker with",
      },
    ]);
  });

  it("defaults to the bucket it was opened from", async () => {
    const user = await openAndPaste("First idea here", {
      type: "bucket",
      defaultBucket: buckets[1],
    });

    expect(screen.getByLabelText("Where should they go?")).toHaveValue("one");
    await user.click(screen.getByRole("button", { name: "Import 1 idea" }));

    expect(importBodies()[0].rows[0].target).toEqual({
      type: "existing",
      bucketId: 11,
    });
  });

  it("lets a single row go somewhere else", async () => {
    const user = await openAndPaste("First idea here{enter}Second idea here");
    await waitFor(() =>
      expect(
        screen.getAllByRole("option", { name: "Games" }).length,
      ).toBeGreaterThan(0),
    );

    await user.selectOptions(
      screen.getByLabelText("Bucket for line 2"),
      "existing:11",
    );
    await user.click(screen.getByRole("button", { name: "Import 2 ideas" }));

    expect(
      importBodies()[0].rows.map((row: { target: unknown }) => row.target),
    ).toEqual([{ type: "auto" }, { type: "existing", bucketId: 11 }]);
  });

  it("uses the file's bucket column when there is one", async () => {
    const user = userEvent.setup();
    render(<ImportIdeasModal type="inline" />);
    await user.click(screen.getByRole("button", { name: /Import/ }));
    await user.click(screen.getByRole("tab", { name: "Upload CSV" }));
    await user.upload(
      screen.getByLabelText("CSV file"),
      new File(
        [
          "title,description,bucket\nDog bowl,A smart dog bowl,Pets\n,Loose idea here,\n",
        ],
        "ideas.csv",
        { type: "text/csv" },
      ),
    );

    expect(await screen.findByLabelText("Where should they go?")).toHaveValue(
      "column",
    );
    await user.click(screen.getByRole("button", { name: "Import 2 ideas" }));

    expect(importBodies()[0].rows).toEqual([
      {
        title: "Dog bowl",
        description: "A smart dog bowl",
        target: { type: "named", name: "Pets" },
      },
      { description: "Loose idea here", target: { type: "auto" } },
    ]);
  });

  it("lists skipped lookalikes and imports them anyway", async () => {
    const skippedRow = {
      description: "Smart dog bowl",
      target: { type: "auto" as const },
    };
    importResponses.push(
      streamed(
        done({
          created: 1,
          skipped: [
            { row: skippedRow, duplicateOf: { id: 7, title: "Dog bowl" } },
          ],
        }),
      ),
      streamed(done({ created: 1 })),
    );
    const user = await openAndPaste("Smart dog bowl{enter}Cat GPS collar");
    await user.click(screen.getByRole("button", { name: "Import 2 ideas" }));

    expect(await screen.findByText(/like "Dog bowl"/)).toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: "Import these anyway" }),
    );

    expect(importBodies()[1]).toEqual({
      rows: [skippedRow],
      allowDuplicates: true,
    });
    expect(
      await screen.findByText("Added 2 ideas to the hoard."),
    ).toBeInTheDocument();
  });

  it("shows a failed import and goes back to the preview", async () => {
    importResponses.push(
      streamed({
        type: "error",
        message: "The goblin dropped your import. Nothing was saved.",
      }),
    );
    const user = await openAndPaste("First idea here");
    await user.click(screen.getByRole("button", { name: "Import 1 idea" }));

    expect(
      await screen.findByText(
        "The goblin dropped your import. Nothing was saved.",
      ),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Back to preview" }));
    expect(screen.getAllByTestId("import-row")).toHaveLength(1);
  });

  it("explains a CSV with several columns and no header", async () => {
    const user = userEvent.setup();
    render(<ImportIdeasModal type="inline" />);
    await user.click(screen.getByRole("button", { name: /Import/ }));
    await user.click(screen.getByRole("tab", { name: "Upload CSV" }));
    await user.upload(
      screen.getByLabelText("CSV file"),
      new File(["Idea one,Games\n"], "ideas.csv", { type: "text/csv" }),
    );

    expect(
      await screen.findByText(/header row with a "description" column/),
    ).toBeInTheDocument();
  });
});
