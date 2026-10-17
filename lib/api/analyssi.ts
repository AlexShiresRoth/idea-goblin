import { eq } from "drizzle-orm";
import { AuthGuard } from "../auth/auth-guard";
import { db } from "../db";
import { analysisResultsTable } from "../db/schema";

export async function getAnalysisResults() {
  try {
    const session = await AuthGuard();
    if (!session) {
      return [];
    }
    const analysisResults = await db
      .select()
      .from(analysisResultsTable)
      .where(eq(analysisResultsTable.profileId, session.user.id));
    return analysisResults;
  } catch (error) {
    console.error(error);
    return [];
  }
}
