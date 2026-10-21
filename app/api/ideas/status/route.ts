import { touchBuckets } from "@/lib/api/buckets";
import { AuthGuard } from "@/lib/auth/auth-guard";
import { IDEA_STATUS } from "@/lib/constants";
import { db } from "@/lib/db";
import { ideaBucketLinksTable, ideasTable } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

// Marks an idea done (archived, but kept) or open again.
export async function POST(request: Request) {
  try {
    const session = await AuthGuard();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { ideaId, done } = (await request.json()) as {
      ideaId?: number;
      done?: boolean;
    };
    if (!ideaId || typeof done !== "boolean") {
      return NextResponse.json(
        { error: "Idea ID and done are required" },
        { status: 400 },
      );
    }

    const [updated] = await db
      .update(ideasTable)
      .set({
        status: done ? IDEA_STATUS.done : IDEA_STATUS.open,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(ideasTable.id, ideaId),
          eq(ideasTable.profileId, session.user.id),
        ),
      )
      .returning({ id: ideasTable.id, status: ideasTable.status });

    if (!updated) {
      return NextResponse.json({ error: "Idea not found" }, { status: 404 });
    }

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
