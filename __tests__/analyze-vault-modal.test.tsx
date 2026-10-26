import AnalyzeVault, {
  AnalyzeVaultModal,
} from "@/app/components/analyze-vault";
import { ToastContext } from "@/app/context/toast.provider";
import { MAX_REFINEMENT_ROUNDS } from "@/lib/constants";
import type {
  BucketOption,
  BucketRefinementResult,
  ExecutionResult,
} from "@/lib/types";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const refresh = vi.fn();
const setToasts = vi.fn();
const onClose = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
}));

type Handler = (init?: RequestInit) => Response | Promise<Response>;

function ndjson(events: object[]) {
  return new Response(events.map((e) => JSON.stringify(e)).join("\n") + "\n");
}

// A streamed response whose events are pushed by the test.
function controlledStream() {
  let controller!: ReadableStreamDefaultController<Uint8Array>;
  const body = new ReadableStream<Uint8Array>({
    start(c) {
      controller = c;
    },
  });
  const encoder = new TextEncoder();
  return {
    response: new Response(body),
    push(event: object) {
      controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
    },
    close() {
      controller.close();
    },
  };
}

function mockFetch(routes: Record<string, Handler>) {
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    const handler = routes[url];
    if (!handler) throw new Error(`Unexpected fetch ${url}`);
    return handler(init);
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function bodiesFor(fetchMock: ReturnType<typeof mockFetch>, url: string) {
  return fetchMock.mock.calls
    .filter(([called]) => called === url)
    .map(([, init]) => JSON.parse(String(init?.body)));
}

function renderModal() {
  return render(
    <ToastContext.Provider value={{ toasts: [], setToasts }}>
      <AnalyzeVaultModal onClose={onClose} />
    </ToastContext.Provider>,
  );
}

const execution: ExecutionResult = {
  summary: "Ship the newsletter first",
  choices: [
    {
      bucket_id: 1,
      title: "Newsletter tools",
      main_idea: "Tools for indie writers",
      score: 82,
      feasibility: 70,
      estimated_effort: "low",
      recommendation: "pursue",
    },
    {
      bucket_id: 2,
      title: "Space elevator",
      score: 20,
      feasibility: 5,
      estimated_effort: "high",
      recommendation: "kill",
    },
  ],
};

const buckets: BucketOption[] = [
  { id: 1, name: "Newsletter tools", description: "For writers", theme: "" },
  { id: 2, name: "Garden apps", description: "For plants", theme: "" },
];

function refinementDraft(n: number): BucketRefinementResult {
  return {
    bucket_id: 2,
    original_name: "Garden apps",
    original_description: "For plants",
    refined_name: `Plant Pal v${n}`,
    refined_description: `Draft ${n} description`,
    refined_category: "health",
    improvements: [`Improvement ${n}`],
    reasoning: { main_idea: `Reason ${n}`, reasons: [] },
  };
}

async function startExecution(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: /Pick a Winner/ }));
  await user.click(
    screen.getByRole("button", { name: "Start" }),
  );
}

describe("AnalyzeVaultModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  describe("a run that fails before any result", () => {
    it("keeps the failed step on screen and can try again", async () => {
      const fetchMock = mockFetch({
        "/api/vault/analyze": vi
          .fn()
          .mockResolvedValueOnce(
            ndjson([
              { type: "status", step: "read", message: "Reading vault" },
              { type: "error", message: "The goblin tripped" },
            ]),
          )
          .mockResolvedValueOnce(ndjson([{ type: "done", data: execution }])),
      });
      const user = userEvent.setup();
      renderModal();

      await startExecution(user);

      expect(await screen.findByText("The goblin tripped")).toBeInTheDocument();
      expect(screen.getByText("Reading vault")).toBeInTheDocument();
      // Still on the run, not back at the pathway picker.
      expect(
        screen.queryByRole("button", { name: "Start" }),
      ).not.toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: "Try again" }));

      expect(bodiesFor(fetchMock, "/api/vault/analyze")).toEqual([
        { pathway: "execution" },
        { pathway: "execution" },
      ]);
      // The retried run's results replace the error.
      expect(await screen.findAllByText("Newsletter tools")).not.toHaveLength(
        0,
      );
      expect(screen.queryByText("The goblin tripped")).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: "Try again" }),
      ).not.toBeInTheDocument();
    });
  });

  describe("pathway selection", () => {
    it("lists the three pathways and enables Start once one is picked", async () => {
      mockFetch({});
      const user = userEvent.setup();
      renderModal();

      expect(screen.getByText("Analyze Vault")).toBeInTheDocument();
      for (const title of ["Pick a Winner", "Sharpen a Bucket", "Gameplan"]) {
        expect(
          screen.getByRole("button", { name: new RegExp(title) }),
        ).toBeInTheDocument();
      }
      expect(
        screen.getByRole("button", { name: "Select a pathway" }),
      ).toBeDisabled();

      await user.click(screen.getByRole("button", { name: /^Gameplan/ }));
      expect(
        screen.getByRole("button", { name: "Start" }),
      ).toBeEnabled();

      await user.click(screen.getByRole("button", { name: /Sharpen a Bucket/ }));
      expect(
        screen.getByRole("button", { name: "Start" }),
      ).toBeEnabled();
    });

    it("cancels", async () => {
      mockFetch({});
      const user = userEvent.setup();
      renderModal();

      await user.click(screen.getByRole("button", { name: "Cancel" }));
      expect(onClose).toHaveBeenCalled();
    });

    it("opens from the trigger and closes again", async () => {
      mockFetch({});
      const onTrigger = vi.fn();
      const user = userEvent.setup();
      render(
        <ToastContext.Provider value={{ toasts: [], setToasts }}>
          <AnalyzeVault variant="menu" onTrigger={onTrigger} />
        </ToastContext.Provider>,
      );

      await user.click(screen.getByRole("button", { name: "Analyze Vault" }));
      expect(onTrigger).toHaveBeenCalled();
      expect(screen.getByText("Select a pathway")).toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: "Cancel" }));
      expect(screen.queryByText("Select a pathway")).not.toBeInTheDocument();
    });
  });

  describe("execution run", () => {
    it("streams progress and results, shows reasoning, and saves", async () => {
      const stream = controlledStream();
      const fetchMock = mockFetch({
        "/api/vault/analyze": () => stream.response,
        "/api/vault/save": () => Response.json({ id: 42 }),
      });
      const user = userEvent.setup();
      renderModal();

      await startExecution(user);
      expect(bodiesFor(fetchMock, "/api/vault/analyze")).toEqual([
        { pathway: "execution" },
      ]);
      expect(
        screen.getAllByText("Waking the goblin...").length,
      ).toBeGreaterThan(0);

      stream.push({ type: "status", step: "read", message: "Reading vault" });
      expect(await screen.findAllByText("Reading vault")).not.toHaveLength(0);

      stream.push({ type: "status", step: "score", message: "Scoring ideas" });
      stream.push({
        type: "partial",
        data: { ...execution, choices: [execution.choices[0]] },
      });
      expect(await screen.findByText("Newsletter tools")).toBeInTheDocument();
      expect(screen.getAllByText("Scoring ideas").length).toBeGreaterThan(0);
      expect(screen.getByText("Reading vault")).toBeInTheDocument();

      stream.push({ type: "done", data: execution });
      stream.close();

      expect(await screen.findByText("Space elevator")).toBeInTheDocument();
      await waitFor(() =>
        expect(
          screen.getByRole("button", { name: "Save Analysis" }),
        ).toBeEnabled(),
      );
      expect(screen.queryByText("Reading vault")).not.toBeInTheDocument();
      expect(
        screen.queryByLabelText("Reply to this draft"),
      ).not.toBeInTheDocument();

      expect(
        screen.queryByText("Ship the newsletter first"),
      ).not.toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: "Show Reasoning" }));
      expect(screen.getByText("Ship the newsletter first")).toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: "Show Reasoning" }));
      expect(
        screen.queryByText("Ship the newsletter first"),
      ).not.toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: "Save Analysis" }));
      expect(bodiesFor(fetchMock, "/api/vault/save")).toEqual([
        { data: execution, analysisType: "execution" },
      ]);
      expect(
        await screen.findByRole("button", { name: "Saved" }),
      ).toBeDisabled();
      expect(setToasts).toHaveBeenCalledWith([
        expect.objectContaining({
          message: "Stashed in the hoard",
          type: "success",
        }),
      ]);
    });

    it("toasts an error when saving fails", async () => {
      mockFetch({
        "/api/vault/analyze": () => ndjson([{ type: "done", data: execution }]),
        "/api/vault/save": () => new Response("nope", { status: 500 }),
      });
      const user = userEvent.setup();
      renderModal();

      await startExecution(user);
      await user.click(
        await screen.findByRole("button", { name: "Save Analysis" }),
      );

      expect(
        await screen.findByText("Failed to save analysis"),
      ).toBeInTheDocument();
      expect(setToasts).toHaveBeenCalledWith([
        expect.objectContaining({
          message: "Failed to save analysis",
          type: "error",
        }),
      ]);
      expect(
        screen.getByRole("button", { name: "Save Analysis" }),
      ).toBeEnabled();
    });

    it("shows the rate limit message from a 429", async () => {
      mockFetch({
        "/api/vault/analyze": () =>
          new Response("Slow down, goblin is tired", { status: 429 }),
      });
      const user = userEvent.setup();
      renderModal();

      await startExecution(user);

      expect(
        await screen.findByText("Slow down, goblin is tired"),
      ).toBeInTheDocument();
    });

    it("shows a generic failure for a non-OK response", async () => {
      mockFetch({
        "/api/vault/analyze": () => new Response("boom", { status: 500 }),
      });
      const user = userEvent.setup();
      renderModal();

      await startExecution(user);

      expect(
        await screen.findByText("Failed to start analysis"),
      ).toBeInTheDocument();
    });

    it("shows the message from an error event", async () => {
      mockFetch({
        "/api/vault/analyze": () =>
          ndjson([{ type: "error", message: "The goblin tripped" }]),
      });
      const user = userEvent.setup();
      renderModal();

      await startExecution(user);

      expect(await screen.findByText("The goblin tripped")).toBeInTheDocument();
    });

    it("keeps the partial result and steps when a run errors midway", async () => {
      mockFetch({
        "/api/vault/analyze": () =>
          ndjson([
            { type: "status", step: "read", message: "Reading vault" },
            {
              type: "partial",
              data: { ...execution, choices: [execution.choices[0]] },
            },
            { type: "error", message: "The goblin tripped" },
          ]),
      });
      const user = userEvent.setup();
      renderModal();

      await startExecution(user);

      expect(await screen.findByText("The goblin tripped")).toBeInTheDocument();
      expect(screen.getByText("Reading vault")).toBeInTheDocument();
      expect(screen.getByText("Newsletter tools")).toBeInTheDocument();
    });

    it("notes when the result came from cache", async () => {
      mockFetch({
        "/api/vault/analyze": () =>
          ndjson([{ type: "done", data: execution, cached: true }]),
      });
      const user = userEvent.setup();
      renderModal();

      await startExecution(user);

      expect(
        await screen.findByText(/Nothing changed since your last run/),
      ).toBeInTheDocument();
    });

    it("minimizes, maximizes and closes", async () => {
      mockFetch({
        "/api/vault/analyze": () => ndjson([{ type: "done", data: execution }]),
      });
      const user = userEvent.setup();
      renderModal();

      await startExecution(user);
      await user.click(await screen.findByRole("button", { name: "Minimize" }));
      await user.click(screen.getByRole("button", { name: "Maximize" }));
      expect(
        screen.getByRole("button", { name: "Minimize" }),
      ).toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: "Close" }));
      expect(onClose).toHaveBeenCalled();
    });
  });

  describe("refinement without a scoped bucket", () => {
    function refinementRoutes(
      extra: Record<string, Handler> = {},
    ): Record<string, Handler> {
      let draft = 0;
      return {
        "/api/buckets/list": () => Response.json(buckets),
        "/api/vault/analyze": () =>
          ndjson([{ type: "done", data: refinementDraft(++draft) }]),
        ...extra,
      };
    }

    async function openPicker(user: ReturnType<typeof userEvent.setup>) {
      await user.click(screen.getByRole("button", { name: /Sharpen a Bucket/ }));
      await user.click(
        screen.getByRole("button", { name: "Start" }),
      );
      await screen.findByRole("button", { name: /Garden apps/ });
    }

    async function refineGarden(user: ReturnType<typeof userEvent.setup>) {
      await openPicker(user);
      await user.click(screen.getByRole("button", { name: /Garden apps/ }));
      await user.click(
        screen.getByRole("button", { name: "Refine Garden apps" }),
      );
      await screen.findByText("Plant Pal v1");
    }

    it("loads the buckets and goes back to the pathways", async () => {
      mockFetch(refinementRoutes());
      const user = userEvent.setup();
      renderModal();

      await openPicker(user);
      expect(screen.getByText("Choose a bucket")).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Refine this bucket" }),
      ).toBeDisabled();

      await user.click(screen.getByRole("button", { name: "Back" }));
      expect(screen.getByText("Analyze Vault")).toBeInTheDocument();
    });

    it("shows an error when the buckets fail to load", async () => {
      mockFetch({
        "/api/buckets/list": () => new Response("no", { status: 500 }),
      });
      const user = userEvent.setup();
      renderModal();

      await user.click(screen.getByRole("button", { name: /Sharpen a Bucket/ }));
      await user.click(
        screen.getByRole("button", { name: "Start" }),
      );

      expect(
        await screen.findByText("Failed to load buckets"),
      ).toBeInTheDocument();
    });

    it("selects the bucket Goblin recommends and shows why", async () => {
      const fetchMock = mockFetch(
        refinementRoutes({
          "/api/vault/recommend": () =>
            Response.json({
              bucketId: 2,
              name: "Garden apps",
              description: "For plants",
              reason: "It has the most ideas waiting",
            }),
        }),
      );
      const user = userEvent.setup();
      renderModal();

      await openPicker(user);
      await user.click(
        screen.getByRole("button", { name: "Let Goblin recommend" }),
      );

      expect(
        await screen.findByText("It has the most ideas waiting"),
      ).toBeInTheDocument();
      expect(fetchMock).toHaveBeenCalledWith("/api/vault/recommend", {
        method: "POST",
      });

      await user.click(
        screen.getByRole("button", { name: "Refine Garden apps" }),
      );
      expect(bodiesFor(fetchMock, "/api/vault/analyze")).toEqual([
        { pathway: "refinement", bucketId: 2, focus: [] },
      ]);
    });

    it("shows an error when the recommendation fails", async () => {
      mockFetch(
        refinementRoutes({
          "/api/vault/recommend": () => new Response("no", { status: 500 }),
        }),
      );
      const user = userEvent.setup();
      renderModal();

      await openPicker(user);
      await user.click(
        screen.getByRole("button", { name: "Let Goblin recommend" }),
      );

      expect(
        await screen.findByText("Failed to recommend a bucket"),
      ).toBeInTheDocument();
    });

    it("updates the bucket with the refined draft", async () => {
      const fetchMock = mockFetch(
        refinementRoutes({
          "/api/buckets/update": () => Response.json({ ok: true }),
        }),
      );
      const user = userEvent.setup();
      renderModal();

      await refineGarden(user);
      expect(screen.getByText("Draft 1 description")).toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: "Show Reasoning" }));
      expect(screen.getByText("Reason 1")).toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: "Update bucket" }));

      expect(bodiesFor(fetchMock, "/api/buckets/update")).toEqual([
        {
          bucketId: 2,
          name: "Plant Pal v1",
          description: "Draft 1 description",
          category: "health",
        },
      ]);
      expect(
        await screen.findByRole("button", { name: "Bucket updated" }),
      ).toBeDisabled();
      expect(setToasts).toHaveBeenCalledWith([
        expect.objectContaining({
          message: "Bucket polished up. The old one is kept in its versions.",
          type: "success",
        }),
      ]);
      expect(refresh).toHaveBeenCalled();
    });

    it("saves the draft linked to its bucket", async () => {
      const fetchMock = mockFetch(
        refinementRoutes({
          "/api/vault/save": () => Response.json({ id: 7 }),
        }),
      );
      const user = userEvent.setup();
      renderModal();

      await refineGarden(user);
      await user.click(screen.getByRole("button", { name: "Save Analysis" }));

      expect(bodiesFor(fetchMock, "/api/vault/save")).toEqual([
        {
          data: refinementDraft(1),
          analysisType: "refinement",
          bucketId: 2,
        },
      ]);
    });

    it("toasts an error when the update fails", async () => {
      mockFetch(
        refinementRoutes({
          "/api/buckets/update": () => new Response("no", { status: 500 }),
        }),
      );
      const user = userEvent.setup();
      renderModal();

      await refineGarden(user);
      await user.click(screen.getByRole("button", { name: "Update bucket" }));

      await waitFor(() =>
        expect(setToasts).toHaveBeenCalledWith([
          expect.objectContaining({
            message: "Failed to update the bucket",
            type: "error",
          }),
        ]),
      );
      expect(
        screen.getByRole("button", { name: "Update bucket" }),
      ).toBeEnabled();
      expect(refresh).not.toHaveBeenCalled();
    });

    it("sends earlier drafts and replies on the next round", async () => {
      const fetchMock = mockFetch(refinementRoutes());
      const user = userEvent.setup();
      renderModal();

      await refineGarden(user);

      const refineAgain = screen.getByRole("button", { name: "Refine again" });
      expect(refineAgain).toBeDisabled();
      await user.type(
        screen.getByLabelText("Reply to this draft"),
        "  shorter name ",
      );
      await user.click(refineAgain);

      expect(await screen.findByText("Plant Pal v2")).toBeInTheDocument();
      expect(bodiesFor(fetchMock, "/api/vault/analyze")[1]).toEqual({
        pathway: "refinement",
        bucketId: 2,
        focus: [],
        rounds: [{ draft: refinementDraft(1), feedback: "shorter name" }],
      });
      expect(screen.getByText("Draft 1")).toBeInTheDocument();
      expect(screen.getByText("shorter name")).toBeInTheDocument();
      expect(screen.getByLabelText("Reply to this draft")).toHaveValue("");
    });

    it("goes back to an earlier draft", async () => {
      mockFetch(refinementRoutes());
      const user = userEvent.setup();
      renderModal();

      await refineGarden(user);
      await user.type(screen.getByLabelText("Reply to this draft"), "again");
      await user.click(screen.getByRole("button", { name: "Refine again" }));
      await screen.findByText("Plant Pal v2");

      await user.click(screen.getByRole("button", { name: "Go back to this" }));

      expect(screen.getByText("Draft 1 description")).toBeInTheDocument();
      expect(screen.queryByText("Plant Pal v2")).not.toBeInTheDocument();
      expect(screen.queryByText("Draft 1")).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: "Go back to this" }),
      ).not.toBeInTheDocument();
    });

    it("stops taking replies after the round limit", async () => {
      const fetchMock = mockFetch(refinementRoutes());
      const user = userEvent.setup();
      renderModal();

      await refineGarden(user);
      for (let round = 1; round <= MAX_REFINEMENT_ROUNDS; round++) {
        await user.type(
          screen.getByLabelText("Reply to this draft"),
          `change ${round}`,
        );
        await user.click(screen.getByRole("button", { name: "Refine again" }));
        await screen.findByText(`Plant Pal v${round + 1}`);
      }

      expect(
        bodiesFor(fetchMock, "/api/vault/analyze").at(-1).rounds,
      ).toHaveLength(MAX_REFINEMENT_ROUNDS);
      expect(
        screen.queryByLabelText("Reply to this draft"),
      ).not.toBeInTheDocument();
      expect(
        screen.getByText(
          new RegExp(`${MAX_REFINEMENT_ROUNDS} rounds of back-and-forth`),
        ),
      ).toBeInTheDocument();
    });
  });
});
