import { AuthGuard } from "@/lib/auth/auth-guard";
import { db } from "@/lib/db";
import { analysisResultsTable } from "@/lib/db/schema";

// TODO - should we compress the payload?
export async function POST(request: Request) {
  try {
    const session = await AuthGuard();

    if (!session) {
      return new Response("Unauthorized", { status: 401 });
    }
    const { data, analysisType } = await request.json();
    if (!data) {
      return new Response("No data provided", { status: 400 });
    }

    await db.insert(analysisResultsTable).values({
      profileId: session.user.id,
      analysisType,
      analysisData: data,
    });

    return new Response("Analysis result saved", { status: 200 });
  } catch (error) {
    console.error(error);
    return new Response("Internal server error", { status: 500 });
  }
}
