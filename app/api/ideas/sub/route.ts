import { AuthGuard } from "@/lib/auth/auth-guard";
import { db } from "@/lib/db";
import {
  ideaBucketLinksTable,
  ideaVersionsTable,
  ideasTable,
} from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import OpenAI from "openai";

const client = new OpenAI();

export async function POST(request: Request) {
  try {
    const session = await AuthGuard();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { parentId, title, description } = (await request.json()) as {
      parentId?: number;
      title?: string;
      description?: string;
    };

    if (!parentId || !title || !description) {
      return NextResponse.json(
        { error: "Parent ID, title, and description are required" },
        { status: 400 },
      );
    }

    const [parent] = await db
      .select()
      .from(ideasTable)
      .where(
        and(
          eq(ideasTable.id, parentId),
          eq(ideasTable.profileId, session.user.id),
        ),
      )
      .limit(1);

    if (!parent) {
      return NextResponse.json({ error: "Idea not found" }, { status: 404 });
    }

    await db.insert(ideaVersionsTable).values({
      ideaId: parent.id,
      title: parent.title,
      description: parent.description,
    });

    let embedding: number[] | null = null;
    try {
      const response = await client.embeddings.create({
        model: "text-embedding-3-small",
        input: `Title: ${title}\nDescription: ${description}`.trim(),
      });
      embedding = response.data[0].embedding;
    } catch (error) {
      console.error(error);
    }

    const [subIdea] = await db
      .insert(ideasTable)
      .values({
        title,
        description,
        category: parent.category,
        type: "sub-idea",
        status: parent.status,
        profileId: session.user.id,
        parentId: parent.id,
        embedding,
      })
      .returning();

    const links = await db
      .select()
      .from(ideaBucketLinksTable)
      .where(eq(ideaBucketLinksTable.ideaId, parent.id));

    if (links.length > 0) {
      await db.insert(ideaBucketLinksTable).values(
        links.map((link) => ({
          ideaId: subIdea.id,
          bucketId: link.bucketId,
        })),
      );
    }

    return NextResponse.json(subIdea);
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to add sub-idea" },
      { status: 500 },
    );
  }
}
