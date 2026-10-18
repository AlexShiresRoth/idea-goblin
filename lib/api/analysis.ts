import { and, desc, eq } from "drizzle-orm";
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
      .where(eq(analysisResultsTable.profileId, session.user.id))
      .orderBy(desc(analysisResultsTable.createdAt));
    return analysisResults;
  } catch (error) {
    console.error(error);
    return [];
  }
}

export async function getAnalysisResult(id: string) {
  try {
    const session = await AuthGuard();
    if (!session) {
      return null;
    }

    const [analysisResult] = await db
      .select()
      .from(analysisResultsTable)
      .where(
        and(
          eq(analysisResultsTable.id, parseInt(id)),
          eq(analysisResultsTable.profileId, session.user.id),
        ),
      );

    return analysisResult ?? null;
  } catch (error) {
    console.error(error);
    return null;
  }
}
