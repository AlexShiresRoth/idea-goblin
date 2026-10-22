// @vitest-environment node
import { AI_MODELS } from "@/lib/ai";
import {
  describeBuckets,
  describeIdeas,
  sortIdeasIntoBuckets,
} from "@/lib/prompts/import";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ db: {} }));
vi.mock("openai/helpers/zod", () => ({
  zodTextFormat: vi.fn((_schema, name) => ({ name })),
}));

const parse = vi.fn();
const client = { responses: { parse } } as never;

function sent() {
  const [params] = parse.mock.calls[0];
  return {
    params,
    system: params.input[0].content as string,
    user: params.input[1].content as string,
  };
}

describe("import prompts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    parse.mockResolvedValue({ output_parsed: null });
  });

  describe("describeIdeas", () => {
    it("lists each idea by index, with its title when it has one", async () => {
      await describeIdeas(client, [
        { index: 0, title: "Dog bowl", description: "A smart dog bowl" },
        { index: 7, description: "A cat GPS collar" },
      ]);

      const { params, system, user } = sent();
      expect(params.model).toBe(AI_MODELS.rank);
      expect(params.reasoning).toEqual({ effort: "low" });
      expect(params.text.format).toEqual({ name: "ideas" });
      expect(user).toBe(
        "index 0 | title: Dog bowl | A smart dog bowl\nindex 7 | A cat GPS collar",
      );
      expect(system).toContain("return that title unchanged");
    });
  });

  describe("sortIdeasIntoBuckets", () => {
    it("sends the new ideas and the existing buckets, trimming long descriptions", async () => {
      await sortIdeasIntoBuckets(
        client,
        [{ id: 10, name: "Pets", description: "x".repeat(300) }],
        [{ index: 0, title: "Dog bowl", description: "A smart dog bowl" }],
      );

      const { params, user } = sent();
      expect(params.reasoning).toEqual({ effort: "medium" });
      expect(user).toContain("index 0 | Dog bowl: A smart dog bowl");
      expect(user).toContain(`id 10 | Pets: ${"x".repeat(200)}`);
      expect(user).not.toContain("x".repeat(201));
    });

    it("says so when the user has no buckets yet", async () => {
      await sortIdeasIntoBuckets(
        client,
        [],
        [{ index: 0, title: "Dog bowl", description: "A smart dog bowl" }],
      );

      expect(sent().user).toContain("(none yet)");
    });
  });

  describe("describeBuckets", () => {
    it("lists each bucket's key, name and ideas", async () => {
      await describeBuckets(client, [
        {
          key: "named:side quests",
          name: "Side quests",
          ideas: [
            { title: "Dog bowl", description: "A smart dog bowl" },
            { title: "Tax tracker", description: "Track deductions" },
          ],
        },
      ]);

      const { system, user } = sent();
      expect(user).toBe(
        "key named:side quests | Side quests\n- Dog bowl: A smart dog bowl\n- Tax tracker: Track deductions",
      );
      // Loose groups are described honestly, not given an invented theme.
      expect(system).toContain("only loosely related");
    });
  });
});
