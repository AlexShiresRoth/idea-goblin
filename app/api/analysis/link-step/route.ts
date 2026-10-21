import { AuthGuard } from "@/lib/auth/auth-guard";
import { db } from "@/lib/db";
import { analysisResultsTable, ideasTable } from "@/lib/db/schema";
import { hasStep, linkStep } from "@/lib/gameplan";
import { isGameplan } from "@/lib/types";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

const LinkSchema = z.object({
  analysisId: z.number().int().positive(),
  ideaId: z.number().int().positive(),
  step: z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("first") }),
    z.object({
      kind: z.literal("phase"),
      phase: z.number().int().min(0),
      step: z.number().int().min(0),
    }),
  ]),
});

// Links a step of a saved gameplan to the idea it was added as.
export async function POST(request: Request) {
  try {
    const session = await AuthGuard();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const parsed = LinkSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid link" }, { status: 400 });
    }
    const { analysisId, ideaId, step } = parsed.data;
    const profileId = session.user.id;

    const [[analysis], [idea]] = await Promise.all([
      db
        .select()
        .from(analysisResultsTable)
        .where(
          and(
            eq(analysisResultsTable.id, analysisId),
            eq(analysisResultsTable.profileId, profileId),
          ),
        ),
      db
        .select({ id: ideasTable.id })
        .from(ideasTable)
        .where(
          and(eq(ideasTable.id, ideaId), eq(ideasTable.profileId, profileId)),
        ),
    ]);

    if (!analysis || !isGameplan(analysis.analysisData)) {
      return NextResponse.json(
        { error: "Gameplan not found" },
        { status: 404 },
      );
    }
    if (!idea) {
      return NextResponse.json({ error: "Idea not found" }, { status: 404 });
    }
    if (!hasStep(analysis.analysisData, step)) {
      return NextResponse.json({ error: "Step not found" }, { status: 400 });
    }

    const data = linkStep(analysis.analysisData, step, ideaId);
    await db
      .update(analysisResultsTable)
      .set({ analysisData: data, updatedAt: new Date() })
      .where(eq(analysisResultsTable.id, analysisId));

    return NextResponse.json(data);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to link step" }, { status: 500 });
  }
}
