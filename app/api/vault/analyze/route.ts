import { AuthGuard } from "@/lib/auth/auth-guard";
import { db } from "@/lib/db";
import {
  ideaBucketLinksTable,
  ideaBucketsTable,
  ideasTable,
} from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { OpenAI } from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import { z } from "zod";
const client = new OpenAI();

type Pathway = "analysis" | "execution" | "refinement";

const AnalysisSchema = z.object({
  choices: z.array(
    z.object({
      main_idea: z.string(),
      bucket_id: z.number(),
      score: z.number(),
      justifications: z.string(),
    }),
  ),
  reasoning: z.string(),
});

const ExecutionSchema = z.object({
  choices: z.array(
    z.object({
      bucket_id: z.number(),
      feasibility: z.number(),
      estimated_effort: z.enum(["low", "medium", "high"]),
      recommendation: z.enum(["pursue", "park", "kill"]),
      reasoning: z.string(),
    }),
  ),
  summary: z.string(),
});

const RefinementSchema = z.object({
  suggestions: z.array(
    z.object({
      bucket_id: z.number(),
      original_idea: z.string(),
      refined_idea: z.string(),
      improvements: z.array(z.string()),
    }),
  ),

  reasoning: z.string(),
});

type PathwayConfig = {
  user_content: string;
  system_content: string;
  response_schema: z.ZodSchema;
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
  
      `.trim(),

    response_schema: AnalysisSchema,
  },

  execution: {
    user_content: "Evaluate which ideas I can realistically execute.",

    system_content: `
  
        Evaluate each idea's feasibility, complexity,
  
        and estimated effort.
  
        Recommend whether to pursue, park, or kill each idea.
  
      `.trim(),

    response_schema: ExecutionSchema,
  },

  refinement: {
    user_content: "Find opportunities to improve my ideas.",

    system_content: `
  
        Identify ideas that could benefit from refinement.
  
        Suggest improvements, narrower scopes,
  
        or alternative directions.
  
        Preserve the original intent of each idea.
  
      `.trim(),

    response_schema: RefinementSchema,
  },
};

async function streamAnalysis(
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

  const stream = client.chat.completions.stream({
    model: "gpt-6-astra",

    messages: [
      {
        role: "system",
        content: config.system_content,
      },

      {
        role: "user",
        content: userContent,
      },
    ],

    response_format: zodResponseFormat(config.response_schema, pathway),
  });

  stream.on("content", (delta, snapshot) => {
    console.log("Delta:", delta);

    console.log("Accumulated:", snapshot);
  });

  const completion = await stream.finalChatCompletion();

  const result = completion.choices[0]?.message;

  if (result?.refusal) {
    throw new Error(result.refusal);
  }

  if (result?.parsed) {
    return result.parsed;
  }

  throw new Error("No structured response returned");
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

    const { pathway } = (await request.json()) as { pathway: Pathway };

    if (!pathway) {
      return new Response("Bad Request", { status: 400 });
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
    await streamAnalysis(pathway, bucketsWithIdeas);

    return NextResponse.json({ message: "Analysis started" });
  } catch (error) {
    console.error(error);
    return new Response("Internal Server Error", { status: 500 });
  }
}
