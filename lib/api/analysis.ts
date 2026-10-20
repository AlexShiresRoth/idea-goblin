import { and, count, desc, eq } from "drizzle-orm";
import { AuthGuard } from "../auth/auth-guard";
import { db } from "../db";
import { analysisResultsTable } from "../db/schema";
import type { PathwayId } from "../types";

export async function getAnalysisResults({
  type,
  page = 1,
  pageSize = 6,
}: { type?: PathwayId; page?: number; pageSize?: number } = {}) {
  try {
    const session = await AuthGuard();
    if (!session) {
      return { items: [], total: 0 };
    }
    const where = and(
      eq(analysisResultsTable.profileId, session.user.id),
      type ? eq(analysisResultsTable.analysisType, type) : undefined,
    );
    const [items, [{ total }]] = await Promise.all([
      db
        .select()
        .from(analysisResultsTable)
        .where(where)
        .orderBy(desc(analysisResultsTable.createdAt))
        .limit(pageSize)
        .offset((page - 1) * pageSize),
      db.select({ total: count() }).from(analysisResultsTable).where(where),
    ]);
    return { items, total };
  } catch (error) {
    console.error(error);
    return { items: [], total: 0 };
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
