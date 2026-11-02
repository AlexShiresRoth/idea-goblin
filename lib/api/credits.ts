import {
  MONTHLY_CREDITS,
  type CreditBalance,
  type Plan,
} from "@/lib/constants";
import { and, eq, gte, sum } from "drizzle-orm";
import "server-only";
import { db } from "../db";
import { aiRunsTable, profileTable } from "../db/schema";

// Allowances refill on the 1st of each month, UTC.
export function creditPeriod(now = new Date()) {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1),
  );
  return { start, end };
}

// Users without a profile yet are on the free plan.
export async function getPlan(profileId: string): Promise<Plan> {
  const [profile] = await db
    .select({ plan: profileTable.plan })
    .from(profileTable)
    .where(eq(profileTable.id, profileId));
  return profile?.plan ?? "free";
}

export async function getCreditBalance(
  profileId: string,
  now = new Date(),
): Promise<CreditBalance> {
  const { start, end } = creditPeriod(now);
  const [plan, [row]] = await Promise.all([
    getPlan(profileId),
    db
      .select({ used: sum(aiRunsTable.credits) })
      .from(aiRunsTable)
      .where(
        and(
          eq(aiRunsTable.profileId, profileId),
          gte(aiRunsTable.createdAt, start),
        ),
      ),
  ]);

  const allowance = MONTHLY_CREDITS[plan];
  const used = Number(row?.used ?? 0);
  return {
    plan,
    allowance,
    used,
    remaining: Math.max(0, allowance - used),
    resetsAt: end.toISOString(),
  };
}
