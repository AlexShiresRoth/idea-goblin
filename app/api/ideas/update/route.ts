import { AuthGuard } from "@/lib/auth/auth-guard";
import { db } from "@/lib/db";
import { ideaVersionsTable, ideasTable } from "@/lib/db/schema";
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

    const { ideaId, title, description } = (await request.json()) as {
      ideaId?: number;
      title?: string;
      description?: string;
    };

    if (!ideaId || !title || !description) {
      return NextResponse.json(
        { error: "Idea ID, title, and description are required" },
        { status: 400 },
      );
    }

    const [idea] = await db
      .select()
      .from(ideasTable)
      .where(
        and(
          eq(ideasTable.id, ideaId),
          eq(ideasTable.profileId, session.user.id),
        ),
      )
      .limit(1);

    if (!idea) {
      return NextResponse.json({ error: "Idea not found" }, { status: 404 });
    }

    await db.insert(ideaVersionsTable).values({
      ideaId: idea.id,
      title: idea.title,
      description: idea.description,
    });

    let embedding = idea.embedding;
    try {
      const response = await client.embeddings.create({
        model: "text-embedding-3-small",
        input: `Title: ${title}\nDescription: ${description}`.trim(),
      });
      embedding = response.data[0].embedding;
    } catch (error) {
      console.error(error);
    }

    const [updated] = await db
      .update(ideasTable)
      .set({
        title,
        description,
        embedding,
        updatedAt: new Date(),
      })
      .where(eq(ideasTable.id, ideaId))
      .returning();

    return NextResponse.json(updated);
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to update idea" },
      { status: 500 },
    );
  }
}
