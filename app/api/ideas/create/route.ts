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
import { findRelevantBucket, generateIdeaResponse } from "@/lib/prompts";
import { Session } from "@supabase/supabase-js";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

type BucketResponse = {
  action: "use_existing" | "create_new";
  bucketId: number | null;
  relevanceScore: number;
  newBucketName: string | null;
  newBucketDescription: string | null;
  newBucketTheme: string | null;
  reasoning: string;
};

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

    const response = await generateIdeaResponse(client, description);

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

    const bucketResponse = await findRelevantBucket(
      client,
      buckets,
      newIdea[0],
    );

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
          theme: bucket.newBucketTheme as string,
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
