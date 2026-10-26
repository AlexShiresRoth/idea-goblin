import { AuthGuard } from "@/lib/auth/auth-guard";
import { db } from "@/lib/db";
import { ideaBucketsTable } from "@/lib/db/schema";
import { and, eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { z } from "zod";

const ShareSchema = z.object({
  bucketId: z.number().int().positive(),
  // "enable" keeps an existing link; "regenerate" replaces it, so links
  // already sent stop working.
  action: z.enum(["enable", "regenerate", "disable"]),
});

// Turns a bucket's share link on or off. Returns the token, or null when the
// bucket is no longer shared.
export async function POST(request: Request) {
  try {
    const session = await AuthGuard();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const parsed = ShareSchema.safeParse(
      await request.json().catch(() => null),
    );
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }
    const { bucketId, action } = parsed.data;

    const token = randomBytes(16).toString("base64url");
    const shareToken =
      action === "disable"
        ? null
        : action === "regenerate"
          ? token
          : sql`coalesce(${ideaBucketsTable.shareToken}, ${token})`;

    const [bucket] = await db
      .update(ideaBucketsTable)
      .set({ shareToken })
      .where(
        and(
          eq(ideaBucketsTable.id, bucketId),
          eq(ideaBucketsTable.profileId, session.user.id),
        ),
      )
      .returning({ shareToken: ideaBucketsTable.shareToken });

    if (!bucket) {
      return NextResponse.json({ error: "Bucket not found" }, { status: 404 });
    }

    return NextResponse.json({ shareToken: bucket.shareToken });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
