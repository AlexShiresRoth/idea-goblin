import { AuthGuard } from "@/lib/auth/auth-guard";
import {
  AI_MODELS,
  findCachedResult,
  hashInput,
  isRateLimited,
  RATE_LIMITS,
  recordRun,
  responseUsage,
} from "@/lib/ai";
import { db } from "@/lib/db";
import { ideaBucketsTable, ideasTable } from "@/lib/db/schema";
import { desc, eq } from "drizzle-orm";
import { OpenAI } from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";
const client = new OpenAI();

type Pathway = "analysis" | "execution" | "refinement";

const MAX_BUCKETS_PER_RUN = 8;
// Includes hidden reasoning tokens; low effort + short fields stay well under.
const RANK_MAX_OUTPUT_TOKENS = 4000;

const AnalysisChoiceSchema = z.object({
  main_idea: z.string(),
  bucket_id: z.number(),
  score: z.number(),
  justifications: z.string(),
});

const ReasoningSchema = z.object({
  main_idea: z.string(),
  reasons: z.array(
    z.object({
      title: z.string(),
      reasoning: z.string(),
    }),
  ),
});

const AnalysisSchema = z.object({
  choices: z.array(AnalysisChoiceSchema),
  reasoning: ReasoningSchema,
});

// No per-choice reasoning object: it was most of the completion length.
const ExecutionChoiceSchema = z.object({
  bucket_id: z.number(),
  title: z.string(),
  main_idea: z.string(),
  score: z.number(),
  feasibility: z.number(),
  estimated_effort: z.enum(["low", "medium", "high"]),
  recommendation: z.enum(["pursue", "park", "kill"]),
  justifications: z.string(),
});

const ExecutionSchema = z.object({
  choices: z.array(ExecutionChoiceSchema),
  summary: z.string(),
});

const RefinementSchema = z.object({
  idea_id: z.number(),
  original_title: z.string(),
  original_idea: z.string(),
  refined_title: z.string(),
  refined_idea: z.string(),
  improvements: z.array(z.string()),
  reasoning: ReasoningSchema,
});

type PathwayConfig = {
  user_content: string;
  system_content: string;
  response_schema: z.ZodSchema;
  itemsKey: "choices" | "suggestions" | "improvements";
  itemSchema: z.ZodType;
};

const PATHWAY_PROMPTS: Record<Pathway, PathwayConfig> = {
  analysis: {
    user_content: "Analyze all my ideas in my current vault.",
    system_content: `
        Analyze the user's idea buckets.
        Identify patterns and determine which ideas
        are most worth pursuing.
        Score each idea from 0 to 100.
        Use the given bucket_id for each idea.
        Justify each score in one or two sentences.
        Give at most three overall reasons, one sentence each.
      `.trim(),
    response_schema: AnalysisSchema,
    itemsKey: "choices",
    itemSchema: AnalysisChoiceSchema,
  },
  execution: {
    user_content: "Evaluate which ideas are worth attention and which I can realistically execute.",
    system_content: `
        Score each idea independently on two 0-100 scales:
        - score: how worth attention it is (upside, fit, interest)
        - feasibility: how realistically it can be executed now
        Do not let a high value score raise feasibility,
        or a low feasibility lower the value score.
        Estimate effort as low, medium, or high.
        Recommend pursue, park, or kill using both factors:
        - pursue: high value and high feasibility
        - park: high value but low feasibility or high effort
        - kill: low value, even if it is easy
        Use the given bucket_id for each idea.
        Give each idea a short title and a one-sentence main idea.
        Justify the scores and recommendation in one or two sentences.
        Keep the summary to two or three sentences.
      `.trim(),
    response_schema: ExecutionSchema,
    itemsKey: "choices",
    itemSchema: ExecutionChoiceSchema,
  },
  refinement: {
    user_content: "Refine this idea.",
    system_content: `
        Refine one idea at a time.
        Preserve the original intent.
        Suggest a sharper title, a clearer main idea,
        and a short list of concrete improvements.
        Offer a direction the user could add as a sub-idea
        without replacing the original.
      `.trim(),
    response_schema: RefinementSchema,
    itemsKey: "improvements",
    itemSchema: z.string(),
  },
};

function extractClosedItems(
  text: string,
  arrayKey: "choices" | "suggestions" | "improvements",
  itemSchema: z.ZodType,
) {
  const keyIndex = text.indexOf(`"${arrayKey}"`);
  if (keyIndex === -1) return [];

  const bracketIndex = text.indexOf("[", keyIndex);
  if (bracketIndex === -1) return [];

  const items: unknown[] = [];
  let index = bracketIndex + 1;

  while (index < text.length) {
    while (index < text.length && /[\s,]/.test(text[index] ?? "")) {
      index += 1;
    }

    if (text[index] === "]" || text[index] !== "{") break;

    let depth = 0;
    let inString = false;
    let escaped = false;
    const start = index;

    for (; index < text.length; index += 1) {
      const char = text[index];
      if (inString) {
        if (escaped) {
          escaped = false;
        } else if (char === "\\") {
          escaped = true;
        } else if (char === '"') {
          inString = false;
        }
        continue;
      }

      if (char === '"') {
        inString = true;
      } else if (char === "{") {
        depth += 1;
      } else if (char === "}") {
        depth -= 1;
        if (depth === 0) {
          index += 1;
          const parsed = itemSchema.safeParse(
            JSON.parse(text.slice(start, index)),
          );
          if (parsed.success) {
            items.push(parsed.data);
          }
          break;
        }
      }
    }

    if (depth !== 0) break;
  }

  return items;
}

type StreamOptions = {
  pathway: Pathway;
  profileId: string;
  model: string;
  userContent: string;
  inputHash: string;
  limitOutput: boolean;
};

const NDJSON_HEADERS = {
  "Content-Type": "application/x-ndjson; charset=utf-8",
  "Cache-Control": "no-cache, no-transform",
  "X-Accel-Buffering": "no",
  "X-Content-Type-Options": "nosniff",
};

function encodeEvent(event: {
  type: string;
  data?: unknown;
  message?: string;
  cached?: boolean;
}) {
  return new TextEncoder().encode(`${JSON.stringify(event)}\n`);
}

function cachedStream(data: unknown) {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encodeEvent({ type: "done", data, cached: true }));
      controller.close();
    },
  });
}

function streamPathway({
  pathway,
  profileId,
  model,
  userContent,
  inputHash,
  limitOutput,
}: StreamOptions) {
  const config = PATHWAY_PROMPTS[pathway];

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: { type: string; data?: unknown; message?: string }) =>
        controller.enqueue(encodeEvent(event));

      try {
        const stream = client.responses.stream({
          model,
          input: [
            {
              role: "system",
              content: config.system_content,
            },
            {
              role: "user",
              content: userContent,
            },
          ],
          text: { format: zodTextFormat(config.response_schema, pathway) },
          ...(limitOutput && {
            reasoning: { effort: "low" },
            max_output_tokens: RANK_MAX_OUTPUT_TOKENS,
          }),
        });

        let text = "";
        let sentCount = 0;

        for await (const event of stream) {
          if (event.type !== "response.output_text.delta") continue;
          text += event.delta;

          const items = extractClosedItems(
            text,
            config.itemsKey,
            config.itemSchema,
          );
          if (items.length <= sentCount) continue;

          sentCount = items.length;
          send({
            type: "partial",
            data: { [config.itemsKey]: items },
          });
        }

        const final = await stream.finalResponse();
        await recordRun({
          profileId,
          route: pathway,
          model,
          usage: responseUsage(final.usage),
          inputHash,
          result: final.output_parsed ?? undefined,
        });

        if (final.output_parsed) {
          send({ type: "done", data: final.output_parsed });
        } else {
          send({
            type: "error",
            message: "No structured response returned",
          });
        }
        controller.close();
      } catch (error) {
        controller.error(error);
      }
    },
  });
}

// TODO - the different prompt cards should give more description on what they do, maybe an info hover
// TODO : Analysis could produce a vault-level report/visualization,
// Execution could produce a ranked shortlist with “pursue / park / kill,” and Refinement could produce specific ideas with suggested branches.
export async function POST(request: Request) {
  try {
    const session = await AuthGuard();

    if (!session) {
      return new Response("Unauthorized", { status: 401 });
    }

    const { pathway, ideaId } = (await request.json()) as {
      pathway: Pathway;
      ideaId?: number;
    };

    if (!pathway || !(pathway in PATHWAY_PROMPTS)) {
      return new Response("Bad Request", { status: 400 });
    }

    const profileId = session.user.id;
    const config = PATHWAY_PROMPTS[pathway];
    let model: string;
    let userContent: string;

    if (pathway === "refinement") {
      if (!ideaId) {
        return new Response("Idea ID is required", { status: 400 });
      }

      const [idea] = await db
        .select()
        .from(ideasTable)
        .where(eq(ideasTable.id, ideaId));

      if (!idea || idea.profileId !== profileId) {
        return new Response("Idea not found", { status: 404 });
      }

      model = AI_MODELS.refine;
      userContent = `
    ${config.user_content}
    idea_id: ${idea.id}
    title: ${idea.title}
    description: ${idea.description}
    category: ${idea.category}
    type: ${idea.type}
    status: ${idea.status}
  `;
    } else {
      // Only bucket name + description is sent, so only buckets are loaded.
      // Most recently touched buckets first, capped to bound output size.
      const buckets = await db
        .select({
          id: ideaBucketsTable.id,
          name: ideaBucketsTable.name,
          description: ideaBucketsTable.description,
        })
        .from(ideaBucketsTable)
        .where(eq(ideaBucketsTable.profileId, profileId))
        .orderBy(desc(ideaBucketsTable.updatedAt))
        .limit(MAX_BUCKETS_PER_RUN);

      if (buckets.length === 0) {
        return new Response("No idea buckets found", { status: 400 });
      }

      model = AI_MODELS.rank;
      userContent = `
    ${config.user_content}
    ${buckets.map((bucket) => `- bucket_id ${bucket.id} | ${bucket.name}: ${bucket.description}`).join("\n")}
  `;
    }

    // Same prompt + model + input as a previous run: serve that result.
    const inputHash = hashInput(config.system_content, model, userContent);
    const cached = await findCachedResult(profileId, pathway, inputHash);
    if (cached) {
      return new Response(cachedStream(cached), { headers: NDJSON_HEADERS });
    }

    if (await isRateLimited(profileId, pathway)) {
      const limit = RATE_LIMITS[pathway]!;
      return new Response(
        `The Goblin needs a break: ${limit.max} ${pathway} runs per ${limit.windowMinutes} minutes. Check your saved analyses or try again later.`,
        { status: 429 },
      );
    }

    const stream = streamPathway({
      pathway,
      profileId,
      model,
      userContent,
      inputHash,
      limitOutput: pathway !== "refinement",
    });

    return new Response(stream, { headers: NDJSON_HEADERS });
  } catch (error) {
    console.error(error);
    return new Response("Internal Server Error", { status: 500 });
  }
}
