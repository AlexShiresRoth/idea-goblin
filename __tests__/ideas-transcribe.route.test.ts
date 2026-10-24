// @vitest-environment node
import { isRateLimited, recordRun } from "@/lib/ai";
import { AuthGuard } from "@/lib/auth/auth-guard";
import { MAX_TRANSCRIBE_FILE_BYTES } from "@/lib/import/schema";
import { transcribeIdeas } from "@/lib/prompts/import";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeSession } from "./helpers";

vi.mock("openai", () => ({
  default: vi.fn(function () {
    return {};
  }),
}));
vi.mock("@/lib/auth/auth-guard", () => ({ AuthGuard: vi.fn() }));
vi.mock("@/lib/db", () => ({ db: {} }));
vi.mock("@/lib/api/profiles", () => ({
  ensureProfile: vi.fn(async () => ({ id: "user-1" })),
}));
vi.mock("@/lib/prompts/import", () => ({ transcribeIdeas: vi.fn() }));
vi.mock("@/lib/ai", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/ai")>()),
  isRateLimited: vi.fn(),
  recordRun: vi.fn(),
}));

import { POST } from "@/app/api/ideas/import/transcribe/route";

function upload(file?: File) {
  const body = new FormData();
  if (file) body.append("file", file);
  return POST(
    new Request("http://localhost/api/ideas/import/transcribe", {
      method: "POST",
      body,
    }),
  );
}

const photo = () =>
  new File([new Uint8Array([1, 2, 3])], "notes.jpg", { type: "image/jpeg" });

describe("POST /api/ideas/import/transcribe", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(AuthGuard).mockResolvedValue(makeSession() as never);
    vi.mocked(isRateLimited).mockResolvedValue(false);
    vi.mocked(transcribeIdeas).mockResolvedValue({
      usage: { input_tokens: 10, output_tokens: 5 },
      output_parsed: {
        ideas: [
          { title: " Dog bowl ", description: " A smart dog bowl " },
          { title: null, description: "A cat GPS collar" },
          { title: null, description: "   " },
        ],
      },
    } as never);
  });

  it("returns the ideas read from the file, tidied", async () => {
    const response = await upload(photo());

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      ideas: [
        { title: "Dog bowl", description: "A smart dog bowl" },
        { description: "A cat GPS collar" },
      ],
    });
    expect(transcribeIdeas).toHaveBeenCalledWith(expect.anything(), {
      name: "notes.jpg",
      type: "image/jpeg",
      data: Buffer.from([1, 2, 3]).toString("base64"),
    });
    expect(recordRun).toHaveBeenCalledWith(
      expect.objectContaining({ route: "idea-transcribe" }),
    );
  });

  it("rejects signed-out requests", async () => {
    vi.mocked(AuthGuard).mockResolvedValue(null);
    expect((await upload(photo())).status).toBe(401);
  });

  it("rejects a missing file, other file types and big files", async () => {
    expect((await upload()).status).toBe(400);
    expect(
      (await upload(new File(["a,b"], "ideas.csv", { type: "text/csv" })))
        .status,
    ).toBe(400);
    expect(
      (
        await upload(
          new File([new Uint8Array(MAX_TRANSCRIBE_FILE_BYTES + 1)], "big.pdf", {
            type: "application/pdf",
          }),
        )
      ).status,
    ).toBe(413);
    expect(transcribeIdeas).not.toHaveBeenCalled();
  });

  it("stops when the user is rate limited", async () => {
    vi.mocked(isRateLimited).mockResolvedValue(true);

    const response = await upload(photo());

    expect(response.status).toBe(429);
    expect(await response.text()).toContain("scans per");
    expect(transcribeIdeas).not.toHaveBeenCalled();
  });
});
