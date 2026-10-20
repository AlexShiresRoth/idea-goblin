import { snapshotBucket } from "@/lib/api/buckets";
import { AuthGuard } from "@/lib/auth/auth-guard";
import { isBucketCategory } from "@/lib/constants";
import { db } from "@/lib/db";
import { ideaBucketsTable } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const session = await AuthGuard();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { bucketId, name, description, category } = (await request.json()) as {
      bucketId?: number;
      name?: string;
      description?: string;
      category?: string;
    };

    if (!bucketId || !name || !description) {
      return NextResponse.json(
        { error: "Bucket ID, name, and description are required" },
        { status: 400 },
      );
    }

    const [bucket] = await db
      .select()
      .from(ideaBucketsTable)
      .where(
        and(
          eq(ideaBucketsTable.id, bucketId),
          eq(ideaBucketsTable.profileId, session.user.id),
        ),
      )
      .limit(1);

    if (!bucket) {
      return NextResponse.json({ error: "Bucket not found" }, { status: 404 });
    }

    await snapshotBucket(bucket);

    const [updated] = await db
      .update(ideaBucketsTable)
      .set({
        name,
        description,
        // Unknown categories are ignored so the bucket keeps its current one.
        ...(isBucketCategory(category) && { category }),
        updatedAt: new Date(),
      })
      .where(eq(ideaBucketsTable.id, bucketId))
      .returning();

    return NextResponse.json(updated);
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to update bucket" },
      { status: 500 },
    );
  }
}
