import { AuthGuard } from "@/lib/auth/auth-guard";
import { db } from "@/lib/db";
import {
  Idea,
  IdeaBucket,
  ideaBucketLinksTable,
  ideaBucketsTable,
  ideasTable,
  profileTable,
} from "@/lib/db/schema";
import { Session } from "@supabase/supabase-js";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import OpenAI from "openai";

// TODO - clean up this route
const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

type BucketResponse = {
  action: "use_existing" | "create_new";
  bucketId: number | null;
  relevanceScore: number;
  newBucketName: string | null;
  newBucketDescription: string | null;
  reasoning: string;
};

async function generateIdeaResponse(description: string) {
  return await client.chat.completions.create({
    model: "gpt-6-astra",
    messages: [
      {
        role: "user",
        content: description,
      },
      {
        role: "system",
        content: `You are an idea goblin, that helps people stay grounded with their ideas.
           You will be given a description of an idea, and you will need to provide a category, type, and title for the idea.`,
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "idea",
        strict: true,
        schema: {
          type: "object",
          properties: {
            title: {
              type: "string",
              minLength: 3,
              maxLength: 100,
            },
            category: {
              type: "string",
              minLength: 3,
              maxLength: 100,
            },
            type: {
              type: "string",
              minLength: 3,
              maxLength: 100,
            },
          },
          required: ["title", "category", "type"],
          additionalProperties: false,
        },
      },
    },
    reasoning_effort: "medium",
  });
}

async function findRelevantBucket(buckets: IdeaBucket[], idea: Idea) {
  return await client.chat.completions.create({
    model: "gpt-6-astra",
    messages: [
      {
        role: "system",
        content: `
          You classify a user's new idea into an existing idea bucket.

          A bucket represents a broader project, product, or concept that multiple related ideas may belong to.

          Your goal is to determine whether the new idea is meaningfully part of one of the existing buckets.

          Rules:
          - Prefer an existing bucket when the idea is a feature, extension, variation, or closely related concept within that bucket.
          - Do NOT match based only on superficial words, category, or type.
          - Consider the underlying purpose, target user, problem being solved, and product/project context.
          - Do NOT force an idea into an existing bucket when the relationship is weak.
          - If multiple buckets are relevant, choose the single most relevant bucket.
          - If no existing bucket is sufficiently relevant, recommend creating a new bucket.
          - Never invent an ID for a new bucket.
          - relevanceScore represents confidence that the idea belongs to the selected existing bucket.
          - A new bucket should have a concise name and description representing the broader concept, not merely repeat the idea's title.
                  `.trim(),
      },
      {
        role: "user",
        content: `
          NEW IDEA

          Title: ${idea.title}
          Type: ${idea.type}
          Category: ${idea.category}
          Description: ${idea.description}

          EXISTING BUCKETS

          ${buckets
            .map(
              (bucket) => `
          ID: ${bucket.id}
          Name: ${bucket.name}
          Description: ${bucket.description}
          `,
            )
            .join("\n")}
                  `.trim(),
      },
    ],

    response_format: {
      type: "json_schema",
      json_schema: {
        name: "bucket_classification",
        strict: true,
        schema: {
          type: "object",
          properties: {
            action: {
              type: "string",
              enum: ["use_existing", "create_new"],
            },

            bucketId: {
              type: ["integer", "null"],
            },

            relevanceScore: {
              type: "number",
              minimum: 0,
              maximum: 100,
            },

            newBucketName: {
              type: ["string", "null"],
            },

            newBucketDescription: {
              type: ["string", "null"],
            },

            reasoning: {
              type: "string",
              maxLength: 300,
            },
          },

          required: [
            "action",
            "bucketId",
            "relevanceScore",
            "newBucketName",
            "newBucketDescription",
            "reasoning",
          ],

          additionalProperties: false,
        },
      },
    },

    reasoning_effort: "medium",
  });
}

async function createIdea(idea: Omit<Idea, "id">) {
  const newIdea = await db.insert(ideasTable).values(idea).returning();

  return newIdea;
}

async function createIdeaBucket(bucket: Omit<IdeaBucket, "id">) {
  const newBucket = await db
    .insert(ideaBucketsTable)
    .values(bucket)
    .returning();
  return newBucket;
}

async function createIdeaBucketLink(ideaId: number, bucketId: number) {
  const newLink = await db
    .insert(ideaBucketLinksTable)
    .values({ ideaId, bucketId })
    .returning();
  return newLink;
}

async function createProfile(session: Session) {
  const newProfile = await db
    .insert(profileTable)
    .values({
      id: session.user.id,
      name: session.user.user_metadata.name || "Goblinner",
      email: session.user.email as string,
      activeIdeasAmt: 2,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning();

  return newProfile;
}

export async function POST(request: Request) {
  try {
    const session = await AuthGuard();

    let profile = await db
      .select()
      .from(profileTable)
      .where(eq(profileTable.id, session.user.id));

    if (!profile || profile.length === 0) {
      profile = await createProfile(session);
    }

    const payload = (await request.json()) as Idea;

    const { description } = payload;

    if (!description || description.length < 3) {
      return NextResponse.json(
        { error: "Description is required" },
        { status: 400 },
      );
    }

    const response = await generateIdeaResponse(description);

    let idea: Idea;

    try {
      idea = JSON.parse(response?.choices[0]?.message.content as string);
    } catch {
      return NextResponse.json(
        { error: "Invalid idea response" },
        { status: 400 },
      );
    }

    const embedding = await client.embeddings.create({
      model: "text-embedding-3-small",
      input: `
      Title: ${idea.title}
      Type: ${idea.type}
      Category: ${idea.category}
      Description: ${idea.description}
        `.trim(),
    });

    idea.embedding = embedding.data[0].embedding;

    const newIdea = await createIdea({
      title: idea.title,
      category: idea.category,
      type: idea.type,
      description,
      profileId: profile[0].id,
      status: "incubating",
      createdAt: new Date(),
      updatedAt: new Date(),
      embedding: idea.embedding,
    });

    const buckets = await db
      .select()
      .from(ideaBucketsTable)
      .where(eq(ideaBucketsTable.profileId, profile[0].id));

    const bucketResponse = await findRelevantBucket(buckets, newIdea[0]);

    let bucket: BucketResponse;

    try {
      bucket = JSON.parse(
        bucketResponse?.choices[0]?.message.content as string,
      );
    } catch {
      return NextResponse.json(
        { error: "Invalid bucket response" },
        { status: 400 },
      );
    }

    switch (bucket.action) {
      case "create_new":
        const newBucket = await createIdeaBucket({
          name: bucket.newBucketName as string,
          description: bucket.newBucketDescription as string,
          profileId: profile[0].id,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
        await createIdeaBucketLink(newIdea[0].id, newBucket[0].id);
        break;
      case "use_existing":
        await createIdeaBucketLink(newIdea[0].id, bucket.bucketId as number);
        break;
    }

    return NextResponse.json(newIdea);
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

// For my app Side0, I want to add a feature where a band can take their groupchat text and pass it to an API endpoint that will then pull out dates and who has confirmed dates for these shows/practices and put it in their shared calendar.
