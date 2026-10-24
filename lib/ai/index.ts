import { createHash } from "node:crypto";
import { and, count, desc, eq, gte } from "drizzle-orm";
import type { CompletionUsage } from "openai/resources/completions";
import type { ResponseUsage } from "openai/resources/responses/responses";
import "server-only";
import { db } from "../db";
import { aiRunsTable } from "../db/schema";

// Rank cheap, rewrite expensive. Ranking/classification runs on the mini
// model; only bucket refinement uses the premium one.
export const AI_MODELS = {
  rank: process.env.OPENAI_RANK_MODEL ?? "gpt-5.4-mini",
  refine: process.env.OPENAI_REFINE_MODEL ?? "gpt-6-astra",
} as const;

export type AiRoute =
  | "analysis"
  | "execution"
  | "refinement"
  | "gameplan"
  | "idea-create"
  | "bucket-classify"
  | "idea-import"
  | "idea-transcribe";

// Fresh (non-cached) generations allowed per user per window.
export const RATE_LIMITS: Partial<
  Record<AiRoute, { max: number; windowMinutes: number }>
> = {
  analysis: { max: 3, windowMinutes: 60 },
  execution: { max: 3, windowMinutes: 60 },
  refinement: { max: 10, windowMinutes: 60 },
  gameplan: { max: 10, windowMinutes: 60 },
  // One run per import, however many model calls it makes.
  "idea-import": { max: 5, windowMinutes: 60 },
  "idea-transcribe": { max: 10, windowMinutes: 60 },
};

type Usage = { input: number; output: number; reasoning: number };

export function responseUsage(usage?: ResponseUsage | null): Usage {
  return {
    input: usage?.input_tokens ?? 0,
    output: usage?.output_tokens ?? 0,
    reasoning: usage?.output_tokens_details?.reasoning_tokens ?? 0,
  };
}

export function chatUsage(usage?: CompletionUsage | null): Usage {
  return {
    input: usage?.prompt_tokens ?? 0,
    output: usage?.completion_tokens ?? 0,
    reasoning: usage?.completion_tokens_details?.reasoning_tokens ?? 0,
  };
}

export function hashInput(...parts: unknown[]) {
  return createHash("sha256").update(JSON.stringify(parts)).digest("hex");
}

export async function recordRun(run: {
  profileId: string;
  route: AiRoute;
  model: string;
  usage: Usage;
  inputHash?: string;
  result?: unknown;
}) {
  console.info(
    `[ai] ${run.route} model=${run.model} in=${run.usage.input} out=${run.usage.output} reasoning=${run.usage.reasoning}`,
  );
  try {
    await db.insert(aiRunsTable).values({
      profileId: run.profileId,
      route: run.route,
      model: run.model,
      inputHash: run.inputHash ?? null,
      inputTokens: run.usage.input,
      outputTokens: run.usage.output,
      reasoningTokens: run.usage.reasoning,
      result: run.result ?? null,
    });
  } catch (error) {
    // Logging must never break the user-facing request.
    console.error(error);
  }
}

export async function findCachedResult(
  profileId: string,
  route: AiRoute,
  inputHash: string,
) {
  const [run] = await db
    .select({ result: aiRunsTable.result })
    .from(aiRunsTable)
    .where(
      and(
        eq(aiRunsTable.profileId, profileId),
        eq(aiRunsTable.route, route),
        eq(aiRunsTable.inputHash, inputHash),
      ),
    )
    .orderBy(desc(aiRunsTable.createdAt))
    .limit(1);

  return run?.result ?? null;
}

export async function isRateLimited(profileId: string, route: AiRoute) {
  const limit = RATE_LIMITS[route];
  if (!limit) return false;

  const since = new Date(Date.now() - limit.windowMinutes * 60_000);
  const [row] = await db
    .select({ runs: count() })
    .from(aiRunsTable)
    .where(
      and(
        eq(aiRunsTable.profileId, profileId),
        eq(aiRunsTable.route, route),
        gte(aiRunsTable.createdAt, since),
      ),
    );

  return (row?.runs ?? 0) >= limit.max;
}
