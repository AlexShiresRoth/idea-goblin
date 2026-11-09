// @vitest-environment node
import { AI_MODELS } from "@/lib/ai";
import { findRelevantBucket, generateIdeaResponse } from "@/lib/prompts";
import type OpenAI from "openai";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeBucket, makeIdea } from "./helpers";

vi.mock("@/lib/db", () => ({ db: {} }));

const create = vi.fn();
const client = { chat: { completions: { create } } } as unknown as OpenAI;

function sent() {
  const [params] = create.mock.calls[0];
  return {
    params,
    system: params.messages.find(
      (message: { role: string }) => message.role === "system",
    ).content as string,
    user: params.messages.find(
      (message: { role: string }) => message.role === "user",
    ).content as string,
  };
}

describe("idea creation prompts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    create.mockResolvedValue({});
  });

  it("asks for a short plain-language title without rewriting the input description", async () => {
    const description =
      "A deliberately detailed, user-written idea: " +
      "specific detail. ".repeat(40);
    await generateIdeaResponse(client, description);

    const { params, system, user } = sent();
    expect(params.model).toBe(AI_MODELS.rank);
    expect(user).toBe(description);
    expect(system).toContain(
      "use everyday words, active voice, and short sentences",
    );
    expect(system).toContain(
      "When generating an idea title, use at most eight words",
    );
    expect(system).toContain(
      "These writing limits apply only to generated text",
    );
    expect(system).toContain("do not shorten or rewrite them");
  });

  it("asks for a brief bucket overview and classification reason while preserving source context", async () => {
    const bucket = makeBucket({
      name: "My own long bucket name",
      description: "My detailed bucket overview",
    });
    const idea = makeIdea({
      title: "My own idea title",
      description: "My own detailed idea description",
    });
    await findRelevantBucket(client, [bucket], { ...idea, embedding: null });

    const { system, user } = sent();
    expect(system).toContain(
      "use everyday words, active voice, and short sentences",
    );
    expect(system).toContain(
      "When generating a bucket name, use at most eight words",
    );
    expect(system).toContain(
      "one or two short sentences, at most 35 words total",
    );
    expect(system).toContain(
      "Keep reasoning to one short sentence, at most 20 words",
    );
    expect(system).toContain("Do not invent features, benefits, or audiences");
    expect(system).toContain(
      "These writing limits apply only to generated text",
    );
    expect(user).toContain(bucket.name);
    expect(user).toContain(bucket.description);
    expect(user).toContain(idea.title);
    expect(user).toContain(idea.description);
  });
});
