import { AuthGuard } from "@/lib/auth/auth-guard";
import { db } from "@/lib/db";
import {
  ideaBucketLinksTable,
  ideaBucketsTable,
  ideasTable,
} from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function DELETE(request: Request) {
  try {
    const session = await AuthGuard();

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { bucketId } = await request.json();

    if (!bucketId) {
      return NextResponse.json(
        { error: "Bucket ID is required" },
        { status: 400 },
      );
    }

    const bucketIdNumber = parseInt(bucketId);

    const [bucket] = await db
      .select()
      .from(ideaBucketsTable)
      .where(eq(ideaBucketsTable.id, bucketIdNumber))
      .limit(1);

    if (!bucket) {
      return NextResponse.json({ error: "Bucket not found" }, { status: 404 });
    }

    if (bucket.profileId !== session.user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const links = await db
      .select()
      .from(ideaBucketLinksTable)
      .where(eq(ideaBucketLinksTable.bucketId, bucketIdNumber));

    for await (const link of links) {
      await db.delete(ideasTable).where(eq(ideasTable.id, link.ideaId));
      await db
        .delete(ideaBucketLinksTable)
        .where(eq(ideaBucketLinksTable.id, link.id));
    }

    await db
      .delete(ideaBucketsTable)
      .where(eq(ideaBucketsTable.id, bucketIdNumber));

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
