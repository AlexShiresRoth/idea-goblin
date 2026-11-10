import { AuthGuard } from "@/lib/auth/auth-guard";
import { db } from "@/lib/db";
import { ideaBucketsTable } from "@/lib/db/schema";
import { and, eq, isNull } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function DELETE(request: Request) {
  try {
    const session = await AuthGuard();

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => null);
    const bucketId = body?.bucketId;
    if (bucketId == null) {
      return NextResponse.json(
        { error: "Bucket ID is required" },
        { status: 400 },
      );
    }

    const id =
      typeof bucketId === "string" && /^\d+$/.test(bucketId)
        ? Number(bucketId)
        : bucketId;
    if (typeof id !== "number" || !Number.isSafeInteger(id) || id <= 0) {
      return NextResponse.json({ error: "Invalid bucket ID" }, { status: 400 });
    }

    const now = new Date();
    const [bucket] = await db
      .update(ideaBucketsTable)
      .set({
        deletedAt: now,
        activeSince: null,
        shareToken: null,
        updatedAt: now,
      })
      .where(
        and(
          eq(ideaBucketsTable.id, id),
          eq(ideaBucketsTable.profileId, session.user.id),
          isNull(ideaBucketsTable.deletedAt),
        ),
      )
      .returning({ id: ideaBucketsTable.id });

    if (!bucket) {
      return NextResponse.json({ error: "Bucket not found" }, { status: 404 });
    }

    return NextResponse.json(
      { message: "Bucket deleted successfully" },
      { status: 200 },
    );
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
