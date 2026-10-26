import { ensureProfile } from "@/lib/api/profiles";
import { AuthGuard } from "@/lib/auth/auth-guard";
import { db } from "@/lib/db";
import {
  ideaBucketLinksTable,
  ideaBucketsTable,
  ideasTable,
} from "@/lib/db/schema";
import { asc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

const CopySchema = z.object({ token: z.string().min(1).max(64) });

// Saves a shared bucket and its ideas into the signed-in user's account. The
// copy is theirs alone: parked, unshared, and without the owner's gameplans
// or versions.
export async function POST(request: Request) {
  try {
    const session = await AuthGuard();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const parsed = CopySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    const [bucket] = await db
      .select()
      .from(ideaBucketsTable)
      .where(eq(ideaBucketsTable.shareToken, parsed.data.token))
      .limit(1);
    if (!bucket) {
      return NextResponse.json({ error: "Bucket not found" }, { status: 404 });
    }
    if (bucket.profileId === session.user.id) {
      return NextResponse.json(
        { error: "This bucket is already yours" },
        { status: 400 },
      );
    }

    const profile = await ensureProfile(session);
    const ideas = await db
      .select({
        title: ideasTable.title,
        status: ideasTable.status,
        category: ideasTable.category,
        type: ideasTable.type,
        description: ideasTable.description,
        embedding: ideasTable.embedding,
      })
      .from(ideaBucketLinksTable)
      .innerJoin(ideasTable, eq(ideasTable.id, ideaBucketLinksTable.ideaId))
      .where(eq(ideaBucketLinksTable.bucketId, bucket.id))
      .orderBy(asc(ideasTable.createdAt));

    const bucketId = await db.transaction(async (tx) => {
      const [copy] = await tx
        .insert(ideaBucketsTable)
        .values({
          name: bucket.name,
          description: bucket.description,
          theme: bucket.theme,
          category: bucket.category,
          profileId: profile.id,
        })
        .returning({ id: ideaBucketsTable.id });

      if (ideas.length > 0) {
        // A millisecond apart, so the copy lists them in the same order.
        const start = Date.now();
        const copied = await tx
          .insert(ideasTable)
          .values(
            ideas.map((idea, index) => ({
              ...idea,
              profileId: profile.id,
              createdAt: new Date(start + index),
              updatedAt: new Date(start + index),
            })),
          )
          .returning({ id: ideasTable.id });
        await tx
          .insert(ideaBucketLinksTable)
          .values(copied.map(({ id }) => ({ ideaId: id, bucketId: copy.id })));
      }

      return copy.id;
    });

    return NextResponse.json({ bucketId });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
