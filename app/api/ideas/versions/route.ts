import { getIdeaVersions } from "@/lib/api/ideas";
import { AuthGuard } from "@/lib/auth/auth-guard";
import { db } from "@/lib/db";
import { ideasTable } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  try {
    const session = await AuthGuard();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const ideaId = Number(new URL(request.url).searchParams.get("ideaId"));
    if (!ideaId) {
      return NextResponse.json(
        { error: "Idea ID is required" },
        { status: 400 },
      );
    }

    const [idea] = await db
      .select({ id: ideasTable.id })
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

    const versions = await getIdeaVersions(ideaId);
    return NextResponse.json(versions);
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to load versions" },
      { status: 500 },
    );
  }
}
