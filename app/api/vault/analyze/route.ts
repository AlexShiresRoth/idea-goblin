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
import { getBucketIdeas } from "@/lib/api/buckets";
import {
  BUCKET_CATEGORY_NAMES,
  isDone,
  MAX_REFINEMENT_NOTE_LENGTH,
  MAX_REFINEMENT_ROUNDS,
  REFINEMENT_FOCUSES,
} from "@/lib/constants";
import { ideaBucketsTable } from "@/lib/db/schema";
import { encodeEvent, NDJSON_HEADERS } from "@/lib/ndjson";
import { and, desc, eq } from "drizzle-orm";
import { OpenAI } from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";
const client = new OpenAI();

type Pathway = "analysis" | "execution" | "refinement" | "gameplan";
// Pathways about one bucket, which takes ideas as context and follow-ups.
type BucketPathway = "refinement" | "gameplan";

const MAX_BUCKETS_PER_RUN = 8;
// Context for a bucket refinement: its most recent ideas, capped to bound input.
const MAX_IDEAS_PER_REFINEMENT = 30;
// Includes hidden reasoning tokens; low effort + short fields stay well under.
const RANK_MAX_OUTPUT_TOKENS = 4000;
// A gameplan is the longest output on the premium model, so it gets a ceiling.
const GAMEPLAN_MAX_OUTPUT_TOKENS = 8000;

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
  bucket_id: z.number(),
  original_name: z.string(),
  original_description: z.string(),
  refined_name: z.string(),
  refined_description: z.string(),
  refined_category: z.enum(BUCKET_CATEGORY_NAMES),
  improvements: z.array(z.string()),
  reasoning: ReasoningSchema,
});

const GameplanStepSchema = z.object({
  title: z.string(),
  detail: z.string(),
  // An idea in the bucket this step builds on, if any.
  idea_id: z.number().nullable(),
  effort: z.enum(["low", "medium", "high"]),
});

const GameplanPhaseSchema = z.object({
  title: z.string(),
  goal: z.string(),
  steps: z.array(GameplanStepSchema),
});

const GameplanSchema = z.object({
  bucket_id: z.number(),
  bucket_name: z.string(),
  finish_line: z.string(),
  where_you_are: z.string(),
  first_step: z.object({ title: z.string(), detail: z.string() }),
  phases: z.array(GameplanPhaseSchema),
  cut: z.array(z.string()),
  risks: z.array(z.string()),
});

// A previous draft comes back from the client, so only the fields the model
// needs are kept, with lengths capped to bound input.
const short = z.string().max(300);
const long = z.string().max(1500);
const DRAFT_SCHEMAS: Record<BucketPathway, z.ZodType> = {
  refinement: z.object({
    refined_name: z.string().max(200),
    refined_description: z.string().max(2000),
    refined_category: z.string().max(50).optional(),
    improvements: z.array(z.string().max(500)).max(10),
  }),
  gameplan: z.object({
    finish_line: long,
    where_you_are: long,
    first_step: z.object({ title: short, detail: long }),
    phases: z
      .array(
        z.object({
          title: short,
          goal: long,
          steps: z
            .array(
              z.object({
                title: short,
                detail: long,
                idea_id: z.number().nullable(),
                effort: z.enum(["low", "medium", "high"]),
              }),
            )
            .max(10),
        }),
      )
      .max(6),
    cut: z.array(long).max(10),
    risks: z.array(long).max(10),
  }),
};

function roundsSchema(pathway: BucketPathway) {
  return z
    .array(
      z.object({
        draft: DRAFT_SCHEMAS[pathway],
        feedback: z.string().trim().min(1).max(MAX_REFINEMENT_NOTE_LENGTH),
      }),
    )
    .max(MAX_REFINEMENT_ROUNDS)
    .optional();
}

type ItemsKey = "choices" | "suggestions" | "improvements" | "phases";

type PathwayConfig = {
  user_content: string;
  system_content: string;
  response_schema: z.ZodSchema;
  itemsKey: ItemsKey;
  itemSchema: z.ZodType;
  // Reasoning effort and output ceiling; unset means the model's defaults.
  reasoning_effort?: "low" | "medium";
  max_output_tokens?: number;
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
    reasoning_effort: "low",
    max_output_tokens: RANK_MAX_OUTPUT_TOKENS,
  },
  execution: {
    user_content:
      "Evaluate which ideas are worth attention and which I can realistically execute.",
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
    reasoning_effort: "low",
    max_output_tokens: RANK_MAX_OUTPUT_TOKENS,
  },
  refinement: {
    user_content: "Refine this idea bucket.",
    system_content: `
        Refine one idea bucket. The bucket's name and description
        are the main idea; the ideas listed in it are context.
        Preserve the original intent.
        Ideas marked (done) are finished; treat them as progress, not open work.
        Use the ideas to find what the main idea is really about,
        what it is missing, and where it is heading.
        Suggest a sharper name, a clearer description,
        the category that best fits the refined bucket,
        and a short list of concrete improvements.
        If the user gives directions or a note, steer the refinement
        toward them while keeping the original intent.
        If earlier drafts and the user's replies to them follow,
        revise the latest draft to address the latest reply.
        Keep what the user did not push back on.
        The original name and description are still the bucket's.
        Use the given bucket_id.
      `.trim(),
    response_schema: RefinementSchema,
    itemsKey: "improvements",
    itemSchema: z.string(),
  },
  gameplan: {
    user_content: "Make a gameplan to finish this idea bucket.",
    system_content: `
        Make a practical gameplan to finish one idea bucket.
        The bucket's name and description are the goal; its ideas are the raw material.
        Ideas marked (done) are finished: count them as progress and do not plan them again.
        - finish_line: one or two sentences on what "finished" means for this bucket,
          small enough to actually reach.
        - where_you_are: one or two sentences on the current state, given what is done.
        - first_step: one concrete thing the user can do today, in under an hour.
        - phases: three to five phases in order, each with a short goal
          and two to five concrete steps. Steps are actions, not topics.
        - A step that carries out an existing open idea uses that idea's idea_id;
          otherwise idea_id is null. Never invent an idea_id.
        - Rate each step's effort as low, medium, or high.
        - cut: open ideas or scope worth dropping to reach the finish line sooner.
        - risks: the few things most likely to stall it, one sentence each.
        Keep it lean: this is a plan for one person, not a project board.
        If the user gives a note, fit the plan to it (time, skills, constraints).
        If earlier drafts and the user's replies to them follow,
        revise the latest draft to address the latest reply.
        Keep what the user did not push back on.
        Use the given bucket_id and bucket name.
      `.trim(),
    response_schema: GameplanSchema,
    itemsKey: "phases",
    itemSchema: GameplanPhaseSchema,
    // Planning gets more thought than ranking, but never an unbounded run.
    reasoning_effort: "medium",
    max_output_tokens: GAMEPLAN_MAX_OUTPUT_TOKENS,
  },
};

function extractClosedItems(
  text: string,
  arrayKey: ItemsKey,
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

// Progress steps the client shows while a run streams. Each status event
// names one; a repeated step updates its message, e.g. a running count.
type StatusStep = "context" | "cached" | "thinking" | "writing" | "saving";

type FollowUp = { role: "assistant" | "user"; content: string };

type StreamOptions = {
  pathway: Pathway;
  profileId: string;
  model: string;
  userContent: string;
  // Earlier drafts and the user's replies, after the first user message.
  followUps: FollowUp[];
  inputHash: string;
  context: string;
  // How many items the result should hold, when known up front.
  total?: number;
};

function progressMessage(pathway: Pathway, count: number, total?: number) {
  if (pathway === "refinement") {
    return `${count} improvement${count === 1 ? "" : "s"} scratched out`;
  }
  if (pathway === "gameplan") {
    return `${count} phase${count === 1 ? "" : "s"} mapped out`;
  }
  return total
    ? `${count} of ${total} buckets judged`
    : `${count} bucket${count === 1 ? "" : "s"} judged`;
}

type StreamEvent = {
  type: string;
  step?: StatusStep;
  data?: unknown;
  message?: string;
  cached?: boolean;
};

function cachedStream(data: unknown, context: string) {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(
        encodeEvent({ type: "status", step: "context", message: context }),
      );
      controller.enqueue(
        encodeEvent({
          type: "status",
          step: "cached",
          message: "Already chewed on this one, nothing has changed",
        }),
      );
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
  followUps,
  inputHash,
  context,
  total,
}: StreamOptions) {
  const config = PATHWAY_PROMPTS[pathway];

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: StreamEvent) =>
        controller.enqueue(encodeEvent(event));
      const status = (step: StatusStep, message: string) =>
        send({ type: "status", step, message });

      try {
        status("context", context);
        status("thinking", "The goblin is gnawing on it");

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
            ...followUps,
          ],
          text: { format: zodTextFormat(config.response_schema, pathway) },
          ...(config.reasoning_effort && {
            reasoning: { effort: config.reasoning_effort },
          }),
          ...(config.max_output_tokens && {
            max_output_tokens: config.max_output_tokens,
          }),
        });

        let text = "";
        let sentCount = 0;

        for await (const event of stream) {
          if (event.type !== "response.output_text.delta") continue;
          if (!text) status("writing", "Scribbling it down");
          text += event.delta;

          const items = extractClosedItems(
            text,
            config.itemsKey,
            config.itemSchema,
          );
          if (items.length <= sentCount) continue;

          sentCount = items.length;
          status("writing", progressMessage(pathway, sentCount, total));
          send({
            type: "partial",
            data: { [config.itemsKey]: items },
          });
        }

        status("saving", "Stashing it in the hoard");

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

    const { pathway, bucketId, focus, note, rounds } =
      (await request.json()) as {
        pathway: Pathway;
        bucketId?: number;
        focus?: string[];
        note?: string;
        rounds?: unknown;
      };

    if (!pathway || !(pathway in PATHWAY_PROMPTS)) {
      return new Response("Bad Request", { status: 400 });
    }

    const profileId = session.user.id;
    const config = PATHWAY_PROMPTS[pathway];
    let model: string;
    let userContent: string;
    let context: string;
    let total: number | undefined;
    let followUps: FollowUp[] = [];

    if (pathway === "refinement" || pathway === "gameplan") {
      if (!bucketId) {
        return new Response("Bucket ID is required", { status: 400 });
      }

      const parsedRounds = roundsSchema(pathway).safeParse(rounds);
      if (!parsedRounds.success) {
        return new Response("Invalid rounds", { status: 400 });
      }
      // Each round replays as the draft Goblin gave, then the user's reply.
      followUps = (parsedRounds.data ?? []).flatMap((round) => [
        { role: "assistant" as const, content: JSON.stringify(round.draft) },
        { role: "user" as const, content: `reply: ${round.feedback}` },
      ]);

      const [bucket] = await db
        .select()
        .from(ideaBucketsTable)
        .where(
          and(
            eq(ideaBucketsTable.id, bucketId),
            eq(ideaBucketsTable.profileId, profileId),
          ),
        );

      if (!bucket) {
        return new Response("Bucket not found", { status: 404 });
      }

      const ideas = (await getBucketIdeas(bucket.id)).slice(
        -MAX_IDEAS_PER_REFINEMENT,
      );
      // The note is capped to bound input.
      const userNote = note?.trim().slice(0, MAX_REFINEMENT_NOTE_LENGTH);

      context = `Rummaged through "${bucket.name}" and its ${ideas.length} idea${ideas.length === 1 ? "" : "s"}`;
      model = AI_MODELS.refine;

      if (pathway === "refinement") {
        // Unknown focus ids are dropped.
        const focuses = REFINEMENT_FOCUSES.filter((option) =>
          focus?.includes(option.id),
        );
        const directions = focuses.map((option) => `- ${option.instruction}`);
        if (focuses.length > 0) {
          context += `, aiming for ${focuses
            .map((option) => option.label.toLowerCase())
            .join(", ")}`;
        }
        userContent = `
    ${config.user_content}
    ${directions.length > 0 ? `directions:\n    ${directions.join("\n    ")}` : ""}
    ${userNote ? `note from the user: ${userNote}` : ""}
    bucket_id: ${bucket.id}
    name: ${bucket.name}
    description: ${bucket.description}
    theme: ${bucket.theme}
    ideas:
    ${ideas.map((idea) => `- ${idea.title}${isDone(idea) ? " (done)" : ""}: ${idea.description}`).join("\n")}
  `;
      } else {
        const doneCount = ideas.filter(isDone).length;
        if (doneCount > 0) context += ` (${doneCount} done)`;
        userContent = `
    ${config.user_content}
    ${userNote ? `note from the user: ${userNote}` : ""}
    bucket_id: ${bucket.id}
    name: ${bucket.name}
    description: ${bucket.description}
    theme: ${bucket.theme}
    ideas:
    ${ideas.map((idea) => `- idea_id ${idea.id}${isDone(idea) ? " (done)" : ""} | ${idea.title}: ${idea.description}`).join("\n")}
  `;
      }

      if (followUps.length > 0) {
        context += `, reworking draft ${followUps.length / 2} with your reply`;
      }
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

      context = `Rummaged through your ${buckets.length} most recent bucket${buckets.length === 1 ? "" : "s"}`;
      total = buckets.length;

      model = AI_MODELS.rank;
      userContent = `
    ${config.user_content}
    ${buckets.map((bucket) => `- bucket_id ${bucket.id} | ${bucket.name}: ${bucket.description}`).join("\n")}
  `;
    }

    // Same prompt + model + input as a previous run: serve that result.
    const inputHash = hashInput(
      config.system_content,
      model,
      userContent,
      ...(followUps.length > 0 ? [followUps] : []),
    );
    const cached = await findCachedResult(profileId, pathway, inputHash);
    if (cached) {
      return new Response(cachedStream(cached, context), {
        headers: NDJSON_HEADERS,
      });
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
      followUps,
      inputHash,
      context,
      total,
    });

    return new Response(stream, { headers: NDJSON_HEADERS });
  } catch (error) {
    console.error(error);
    return new Response("Internal Server Error", { status: 500 });
  }
}
