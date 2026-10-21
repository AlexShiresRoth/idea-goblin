import { AuthGuard } from "@/lib/auth/auth-guard";
import { db } from "@/lib/db";
import { analysisResultsTable, ideaBucketsTable } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";

// TODO - should we compress the payload?
export async function POST(request: Request) {
  try {
    const session = await AuthGuard();

    if (!session) {
      return new Response("Unauthorized", { status: 401 });
    }
    const { data, analysisType, bucketId } = await request.json();
    if (!data) {
      return new Response("No data provided", { status: 400 });
    }

    // A bucket-level analysis (a gameplan) is linked to its bucket, which
    // must be the user's own.
    if (bucketId != null) {
      const [bucket] = await db
        .select({ id: ideaBucketsTable.id })
        .from(ideaBucketsTable)
        .where(
          and(
            eq(ideaBucketsTable.id, bucketId),
            eq(ideaBucketsTable.profileId, session.user.id),
          ),
        );
      if (!bucket) {
        return new Response("Bucket not found", { status: 404 });
      }
    }

    const [saved] = await db
      .insert(analysisResultsTable)
      .values({
        profileId: session.user.id,
        analysisType,
        analysisData: data,
        bucketId: bucketId ?? null,
      })
      .returning({ id: analysisResultsTable.id });

    // The id lets the client keep editing the saved copy (gameplan links).
    return Response.json({ id: saved.id });
  } catch (error) {
    console.error(error);
    return new Response("Internal server error", { status: 500 });
  }
}
