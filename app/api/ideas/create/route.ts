import { AI_MODELS, chatUsage, recordRun } from "@/lib/ai";
import { touchBuckets } from "@/lib/api/buckets";
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
import type { BucketChoice } from "@/lib/types";
import { Session } from "@supabase/supabase-js";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const MAX_BUCKET_NAME_LENGTH = 100;

type CreateIdeaPayload = {
  description?: string;
  bucket?: BucketChoice;
  bucketName?: string;
};

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

    const {
      description,
      bucket: bucketChoice = "auto",
      bucketName,
    } = (await request.json()) as CreateIdeaPayload;

    if (!description || description.length < 3) {
      return NextResponse.json(
        { error: "Description is required" },
        { status: 400 },
      );
    }

    const buckets = await db
      .select()
      .from(ideaBucketsTable)
      .where(eq(ideaBucketsTable.profileId, profile[0].id));

    // Validate the user's choice before spending any tokens on it.
    if (
      bucketChoice !== "auto" &&
      bucketChoice !== "new" &&
      !buckets.some((existing) => existing.id === bucketChoice)
    ) {
      return NextResponse.json({ error: "Bucket not found" }, { status: 400 });
    }

    if (bucketName && bucketName.trim().length > MAX_BUCKET_NAME_LENGTH) {
      return NextResponse.json(
        { error: "Bucket name is too long" },
        { status: 400 },
      );
    }

    const response = await generateIdeaResponse(client, description);
    await recordRun({
      profileId: profile[0].id,
      route: "idea-create",
      model: AI_MODELS.rank,
      usage: chatUsage(response.usage),
    });

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
      Description: ${description}
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
      parentId: null,
    });

    if (typeof bucketChoice === "number") {
      await createIdeaBucketLink(newIdea[0].id, bucketChoice);
      await touchBuckets([bucketChoice]);
      return NextResponse.json(newIdea);
    }

    if (bucketChoice === "new") {
      const newBucket = await createIdeaBucket({
        name: bucketName?.trim() || idea.title,
        description,
        theme: idea.category,
        profileId: profile[0].id,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      await createIdeaBucketLink(newIdea[0].id, newBucket[0].id);
      return NextResponse.json(newIdea);
    }

    const bucketResponse = await findRelevantBucket(
      client,
      buckets,
      newIdea[0],
    );
    await recordRun({
      profileId: profile[0].id,
      route: "bucket-classify",
      model: AI_MODELS.rank,
      usage: chatUsage(bucketResponse.usage),
    });

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
      case "use_existing": {
        const bucketId = bucket.bucketId;
        if (!buckets.some((existing) => existing.id === bucketId)) {
          // Don't leave an unlinked idea behind for a bad classification.
          await db.delete(ideasTable).where(eq(ideasTable.id, newIdea[0].id));
          return NextResponse.json(
            { error: "Invalid bucket response" },
            { status: 400 },
          );
        }
        await createIdeaBucketLink(newIdea[0].id, bucketId as number);
        await touchBuckets([bucketId as number]);
        break;
      }
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
