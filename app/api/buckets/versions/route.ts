import { getBucketVersions } from "@/lib/api/buckets";
import { AuthGuard } from "@/lib/auth/auth-guard";
import { db } from "@/lib/db";
import { ideaBucketsTable } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  try {
    const session = await AuthGuard();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const bucketId = Number(new URL(request.url).searchParams.get("bucketId"));
    if (!bucketId) {
      return NextResponse.json(
        { error: "Bucket ID is required" },
        { status: 400 },
      );
    }

    const [bucket] = await db
      .select({ id: ideaBucketsTable.id })
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

    return NextResponse.json(await getBucketVersions(bucketId));
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to load versions" },
      { status: 500 },
    );
  }
}
