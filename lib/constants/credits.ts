import type { PathwayId } from "@/lib/types";

// Stored keys; users see PLAN_NAMES. Credits are shown as "gold".
export type Plan = "free" | "pro";

export const PLAN_NAMES: Record<Plan, string> = {
  free: "Scavenger",
  pro: "Hoard Lord",
};

// Credits granted each calendar month (UTC); unused credits don't roll over.
export const MONTHLY_CREDITS: Record<Plan, number> = {
  free: 20,
  pro: 200,
};

// Fixed price per fresh run; cached runs are free. Free refinements run on
// the mini model, so they cost less.
const PATHWAY_CREDITS: Record<PathwayId, Record<Plan, number>> = {
  analysis: { free: 1, pro: 1 },
  execution: { free: 1, pro: 1 },
  refinement: { free: 5, pro: 10 },
  gameplan: { free: 5, pro: 5 },
};

export function creditCost(pathway: PathwayId, plan: Plan) {
  return PATHWAY_CREDITS[pathway][plan];
}

// Below this share of the monthly allowance, the balance is shown as low.
export const LOW_CREDIT_SHARE = 0.2;

export type CreditBalance = {
  plan: Plan;
  allowance: number;
  used: number;
  remaining: number;
  // ISO date the allowance refills.
  resetsAt: string;
};
