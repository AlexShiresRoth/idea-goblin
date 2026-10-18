import { AuthGuard } from "@/lib/auth/auth-guard";
import { db } from "@/lib/db";
import {
  ideaBucketLinksTable,
  ideaBucketsTable,
  ideasTable,
} from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { OpenAI } from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";
const client = new OpenAI();

type Pathway = "analysis" | "execution" | "refinement";

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

const ExecutionChoiceSchema = z.object({
  bucket_id: z.number(),
  title: z.string(),
  main_idea: z.string(),
  score: z.number(),
  justifications: z.string(),
  feasibility: z.number(),
  estimated_effort: z.enum(["low", "medium", "high"]),
  recommendation: z.enum(["pursue", "park", "kill"]),
  reasoning: ReasoningSchema,
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
        Provide clear justifications.
        Instead of a large paragraph of reasoning, provide a list of reasons for each idea, 
        and a general summary of the reasoning.
        Each reason should be a single sentence or two.
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
        Give each idea a short title and a one-sentence main idea.
        Provide a short justification for the value score
        and structured reasoning for the recommendation.
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

function streamRefinement(
  idea: {
    id: number;
    title: string;
    description: string;
    category: string;
    type: string;
    status: string;
  },
) {
  const config = PATHWAY_PROMPTS.refinement;
  const userContent = `
    ${config.user_content}
    idea_id: ${idea.id}
    title: ${idea.title}
    description: ${idea.description}
    category: ${idea.category}
    type: ${idea.type}
    status: ${idea.status}
  `;

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const encoder = new TextEncoder();
      const send = (event: {
        type: string;
        data?: unknown;
        message?: string;
      }) => {
        controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      };

      try {
        const stream = client.responses.stream({
          model: "gpt-6-astra",
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
          text: { format: zodTextFormat(config.response_schema, "refinement") },
        });

        const final = await stream.finalResponse();
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

function streamAnalysis(
  pathway: Pathway,
  bucketsWithIdeas: {
    mainIdea: string;
    description: string;
    lastUpdated: Date;
    createdAt: Date;
    ideas: {
      title: string;
      description: string;
      status: string;
      category: string;
      type: string;
    }[];
  }[],
) {
  const userContent = `
    ${PATHWAY_PROMPTS[pathway].user_content}
    ${bucketsWithIdeas.map((bucket) => `- ${bucket.mainIdea}: ${bucket.description}`).join("\n")}
  `;

  const config = PATHWAY_PROMPTS[pathway];

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const encoder = new TextEncoder();
      const send = (event: {
        type: string;
        data?: unknown;
        message?: string;
      }) => {
        controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      };

      try {
        const stream = client.responses.stream({
          model: "gpt-6-astra",
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

    if (!pathway) {
      return new Response("Bad Request", { status: 400 });
    }

    if (pathway === "refinement") {
      if (!ideaId) {
        return new Response("Idea ID is required", { status: 400 });
      }

      const [idea] = await db
        .select()
        .from(ideasTable)
        .where(eq(ideasTable.id, ideaId));

      if (!idea || idea.profileId !== session.user.id) {
        return new Response("Idea not found", { status: 404 });
      }

      return new Response(streamRefinement(idea), {
        headers: {
          "Content-Type": "application/x-ndjson; charset=utf-8",
          "Cache-Control": "no-cache, no-transform",
          "X-Accel-Buffering": "no",
          "X-Content-Type-Options": "nosniff",
        },
      });
    }

    const ideaBuckets = await db
      .select()
      .from(ideaBucketsTable)
      .where(eq(ideaBucketsTable.profileId, session.user.id));

    if (ideaBuckets.length === 0) {
      return new Response("No idea buckets found", { status: 400 });
    }

    const bucketsWithIdeas = await Promise.all(
      ideaBuckets.map(async (bucket) => {
        const ideas = await db
          .select()
          .from(ideaBucketLinksTable)
          .where(eq(ideaBucketLinksTable.bucketId, bucket.id));
        const foundIdeas = await Promise.all(
          ideas.map(async (link) => {
            const [idea] = await db
              .select()
              .from(ideasTable)
              .where(eq(ideasTable.id, link.ideaId));
            return idea;
          }),
        );

        return {
          mainIdea: bucket.name,
          description: bucket.description,
          lastUpdated: bucket.updatedAt,
          createdAt: bucket.createdAt,
          ideas: foundIdeas.map((idea) => ({
            title: idea.title,
            description: idea.description,
            status: idea.status,
            category: idea.category,
            type: idea.type,
          })),
        };
      }),
    );

    // todo how can we stream this back to the client?
    // TODO - save the responses to the database
    const stream = streamAnalysis(pathway, bucketsWithIdeas);

    return new Response(stream, {
      headers: {
        "Content-Type": "application/x-ndjson; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        "X-Accel-Buffering": "no",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error(error);
    return new Response("Internal Server Error", { status: 500 });
  }
}
