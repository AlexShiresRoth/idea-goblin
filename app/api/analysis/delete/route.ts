import { AuthGuard } from "@/lib/auth/auth-guard";
import { db } from "@/lib/db";
import { analysisResultsTable } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function DELETE(request: Request) {
  try {
    const session = await AuthGuard();

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { analysisId } = (await request.json()) as { analysisId?: number };

    if (!analysisId) {
      return NextResponse.json(
        { error: "Analysis ID is required" },
        { status: 400 },
      );
    }

    const [analysis] = await db
      .select()
      .from(analysisResultsTable)
      .where(eq(analysisResultsTable.id, analysisId))
      .limit(1);

    if (!analysis) {
      return NextResponse.json(
        { error: "Analysis not found" },
        { status: 404 },
      );
    }

    if (analysis.profileId !== session.user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await db
      .delete(analysisResultsTable)
      .where(eq(analysisResultsTable.id, analysisId));

    return NextResponse.json(
      { message: "Analysis deleted successfully" },
      { status: 200 },
    );
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to delete analysis" },
      { status: 500 },
    );
  }
}
