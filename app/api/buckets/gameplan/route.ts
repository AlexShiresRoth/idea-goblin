import { AuthGuard } from "@/lib/auth/auth-guard";
import { db } from "@/lib/db";
import { analysisResultsTable } from "@/lib/db/schema";
import { and, desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

// The bucket's most recently saved gameplan, or null.
export async function GET(request: Request) {
  try {
    const session = await AuthGuard();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const bucketId = Number(new URL(request.url).searchParams.get("bucketId"));
    if (!Number.isInteger(bucketId) || bucketId <= 0) {
      return NextResponse.json(
        { error: "Bucket ID is required" },
        { status: 400 },
      );
    }

    const [gameplan] = await db
      .select({
        id: analysisResultsTable.id,
        createdAt: analysisResultsTable.createdAt,
        data: analysisResultsTable.analysisData,
      })
      .from(analysisResultsTable)
      .where(
        and(
          eq(analysisResultsTable.profileId, session.user.id),
          eq(analysisResultsTable.bucketId, bucketId),
          eq(analysisResultsTable.analysisType, "gameplan"),
        ),
      )
      .orderBy(desc(analysisResultsTable.createdAt))
      .limit(1);

    return NextResponse.json(gameplan ?? null);
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to load gameplan" },
      { status: 500 },
    );
  }
}
