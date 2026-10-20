import { touchBuckets } from "@/lib/api/buckets";
import { AuthGuard } from "@/lib/auth/auth-guard";
import { db } from "@/lib/db";
import { ideaBucketLinksTable, ideasTable } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import OpenAI from "openai";

const client = new OpenAI();

const MAX_TITLE_LENGTH = 200;
const MAX_DESCRIPTION_LENGTH = 500;

// Same input as idea creation, so edited ideas stay comparable to new ones.
async function embed(idea: {
  title: string;
  type: string;
  category: string;
  description: string;
}) {
  try {
    const response = await client.embeddings.create({
      model: "text-embedding-3-small",
      input: `
      Title: ${idea.title}
      Type: ${idea.type}
      Category: ${idea.category}
      Description: ${idea.description}
        `.trim(),
    });
    return response.data[0].embedding;
  } catch (error) {
    console.error(error);
    return null;
  }
}

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
    const trimmedTitle = title?.trim();
    const trimmedDescription = description?.trim();

    if (!ideaId || !trimmedTitle || !trimmedDescription) {
      return NextResponse.json(
        { error: "Idea ID, title, and description are required" },
        { status: 400 },
      );
    }

    if (
      trimmedTitle.length > MAX_TITLE_LENGTH ||
      trimmedDescription.length > MAX_DESCRIPTION_LENGTH
    ) {
      return NextResponse.json(
        { error: "Title or description is too long" },
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

    const changed =
      trimmedTitle !== idea.title || trimmedDescription !== idea.description;
    // Keep the old embedding if a new one can't be made.
    const embedding = changed
      ? await embed({
          ...idea,
          title: trimmedTitle,
          description: trimmedDescription,
        })
      : null;

    const [updated] = await db
      .update(ideasTable)
      .set({
        title: trimmedTitle,
        description: trimmedDescription,
        ...(embedding && { embedding }),
        updatedAt: new Date(),
      })
      .where(eq(ideasTable.id, ideaId))
      .returning({
        id: ideasTable.id,
        title: ideasTable.title,
        description: ideasTable.description,
        updatedAt: ideasTable.updatedAt,
      });

    const links = await db
      .select({ bucketId: ideaBucketLinksTable.bucketId })
      .from(ideaBucketLinksTable)
      .where(eq(ideaBucketLinksTable.ideaId, ideaId));
    await touchBuckets(links.map((link) => link.bucketId));

    return NextResponse.json(updated);
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to update idea" },
      { status: 500 },
    );
  }
}
