import type { GameplanResult, GameplanStepRef } from "./types";

// Whether `ref` points at a step that exists in `plan`.
export function hasStep(plan: GameplanResult, ref: GameplanStepRef) {
  if (ref.kind === "first") return Boolean(plan.first_step);
  return Boolean(plan.phases[ref.phase]?.steps[ref.step]);
}

// The plan with one step linked to an idea, so the step tracks that idea's
// done state instead of offering to add it again.
export function linkStep(
  plan: GameplanResult,
  ref: GameplanStepRef,
  ideaId: number,
): GameplanResult {
  if (ref.kind === "first") {
    return { ...plan, first_step: { ...plan.first_step, idea_id: ideaId } };
  }
  return {
    ...plan,
    phases: plan.phases.map((phase, phaseIndex) =>
      phaseIndex !== ref.phase
        ? phase
        : {
            ...phase,
            steps: phase.steps.map((step, stepIndex) =>
              stepIndex === ref.step ? { ...step, idea_id: ideaId } : step,
            ),
          },
    ),
  };
}
