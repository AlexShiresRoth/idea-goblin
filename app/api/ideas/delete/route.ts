import { AuthGuard } from "@/lib/auth/auth-guard";
import { db } from "@/lib/db";
import { ideaBucketLinksTable, ideasTable } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function DELETE(request: Request) {
  try {
    const session = await AuthGuard();

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { ideaId } = (await request.json()) as { ideaId: string };

    if (!ideaId) {
      return NextResponse.json(
        { error: "Idea ID is required" },
        { status: 400 },
      );
    }

    const ideaIdNumber = parseInt(ideaId);

    const idea = await db
      .select()
      .from(ideasTable)
      .where(eq(ideasTable.id, ideaIdNumber))
      .limit(1);

    if (!idea || idea.length === 0) {
      return NextResponse.json({ error: "Idea not found" }, { status: 404 });
    }

    const ideaData = idea[0];

    if (ideaData.profileId !== session.user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await db.delete(ideasTable).where(eq(ideasTable.id, ideaIdNumber));

    await db
      .delete(ideaBucketLinksTable)
      .where(eq(ideaBucketLinksTable.ideaId, ideaIdNumber));

    return NextResponse.json(
      { message: "Idea deleted successfully" },
      { status: 200 },
    );
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to delete idea" },
      { status: 500 },
    );
  }
}
