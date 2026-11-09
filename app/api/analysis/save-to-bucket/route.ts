import { AuthGuard } from "@/lib/auth/auth-guard";
import { db } from "@/lib/db";
import { analysisResultsTable, ideaBucketsTable } from "@/lib/db/schema";
import { isGameplan } from "@/lib/types";
import { and, eq, ne } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

const SaveSchema = z.object({
  analysisId: z.number().int().positive(),
});
const BucketIdSchema = z.number().int().positive();

class BucketNotFoundError extends Error {}

export async function POST(request: Request) {
  try {
    const session = await AuthGuard();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const parsed = SaveSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid analysis ID" },
        { status: 400 },
      );
    }
    const { analysisId } = parsed.data;
    const profileId = session.user.id;
    const [analysis] = await db
      .select()
      .from(analysisResultsTable)
      .where(
        and(
          eq(analysisResultsTable.id, analysisId),
          eq(analysisResultsTable.profileId, profileId),
        ),
      );

    if (!analysis) {
      return NextResponse.json(
        { error: "Analysis not found" },
        { status: 404 },
      );
    }
    const data = analysis.analysisData;
    if (
      analysis.analysisType !== "gameplan" ||
      !data ||
      typeof data !== "object" ||
      !isGameplan(data)
    ) {
      return NextResponse.json({ error: "Invalid gameplan" }, { status: 400 });
    }
    const bucketIdResult = BucketIdSchema.safeParse(data.bucket_id);
    if (!bucketIdResult.success) {
      return NextResponse.json({ error: "Invalid bucket ID" }, { status: 400 });
    }
    const bucketId = bucketIdResult.data;
    const [bucket] = await db
      .select({ id: ideaBucketsTable.id })
      .from(ideaBucketsTable)
      .where(
        and(
          eq(ideaBucketsTable.id, bucketId),
          eq(ideaBucketsTable.profileId, profileId),
        ),
      );
    if (!bucket) {
      return NextResponse.json({ error: "Bucket not found" }, { status: 404 });
    }

    await db.transaction(async (tx) => {
      // Serialize selections for this bucket before changing its linked plans.
      const [lockedBucket] = await tx
        .select({ id: ideaBucketsTable.id })
        .from(ideaBucketsTable)
        .where(
          and(
            eq(ideaBucketsTable.id, bucketId),
            eq(ideaBucketsTable.profileId, profileId),
          ),
        )
        .for("update");
      if (!lockedBucket) {
        throw new BucketNotFoundError("Bucket not found");
      }

      // Keep prior plans in history, but let the bucket GET find this plan
      // even when its createdAt predates the previously linked plans.
      await tx
        .update(analysisResultsTable)
        .set({ bucketId: null })
        .where(
          and(
            eq(analysisResultsTable.profileId, profileId),
            eq(analysisResultsTable.bucketId, bucketId),
            eq(analysisResultsTable.analysisType, "gameplan"),
            ne(analysisResultsTable.id, analysisId),
          ),
        );
      const [linked] = await tx
        .update(analysisResultsTable)
        .set({ bucketId, updatedAt: new Date() })
        .where(
          and(
            eq(analysisResultsTable.id, analysisId),
            eq(analysisResultsTable.profileId, profileId),
            eq(analysisResultsTable.analysisType, "gameplan"),
          ),
        )
        .returning({ id: analysisResultsTable.id });
      if (!linked) {
        throw new Error("Gameplan disappeared while saving to bucket");
      }
    });

    return NextResponse.json({ bucketId });
  } catch (error) {
    if (error instanceof BucketNotFoundError) {
      return NextResponse.json({ error: "Bucket not found" }, { status: 404 });
    }
    console.error(error);
    return NextResponse.json(
      { error: "Failed to save gameplan to bucket" },
      { status: 500 },
    );
  }
}
