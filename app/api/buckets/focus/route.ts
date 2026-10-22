import { ensureProfile } from "@/lib/api/profiles";
import { AuthGuard } from "@/lib/auth/auth-guard";
import { db } from "@/lib/db";
import { ideaBucketsTable } from "@/lib/db/schema";
import { and, eq, inArray, isNull, notInArray } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

const FocusSchema = z.object({
  bucketIds: z.array(z.number().int().positive()),
});

// Sets which buckets are being worked on. Every other bucket is parked.
// Buckets already active keep when they started.
export async function POST(request: Request) {
  try {
    const session = await AuthGuard();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const parsed = FocusSchema.safeParse(
      await request.json().catch(() => null),
    );
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid buckets" }, { status: 400 });
    }
    const bucketIds = [...new Set(parsed.data.bucketIds)];

    const profile = await ensureProfile(session);
    if (bucketIds.length > profile.activeIdeasAmt) {
      return NextResponse.json(
        {
          error: `You can work on ${profile.activeIdeasAmt} buckets at once`,
        },
        { status: 400 },
      );
    }

    const owned =
      bucketIds.length === 0
        ? []
        : await db
            .select({ id: ideaBucketsTable.id })
            .from(ideaBucketsTable)
            .where(
              and(
                eq(ideaBucketsTable.profileId, profile.id),
                inArray(ideaBucketsTable.id, bucketIds),
              ),
            );
    if (owned.length !== bucketIds.length) {
      return NextResponse.json({ error: "Bucket not found" }, { status: 404 });
    }

    await db.transaction(async (tx) => {
      await tx
        .update(ideaBucketsTable)
        .set({ activeSince: null })
        .where(
          and(
            eq(ideaBucketsTable.profileId, profile.id),
            bucketIds.length > 0
              ? notInArray(ideaBucketsTable.id, bucketIds)
              : undefined,
          ),
        );
      if (bucketIds.length > 0) {
        await tx
          .update(ideaBucketsTable)
          .set({ activeSince: new Date() })
          .where(
            and(
              eq(ideaBucketsTable.profileId, profile.id),
              inArray(ideaBucketsTable.id, bucketIds),
              isNull(ideaBucketsTable.activeSince),
            ),
          );
      }
    });

    return NextResponse.json({ active: bucketIds });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to update focus" },
      { status: 500 },
    );
  }
}
