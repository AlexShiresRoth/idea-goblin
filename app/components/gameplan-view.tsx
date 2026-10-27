"use client";

import { isDone } from "@/lib/constants";
import type {
  GameplanResult,
  GameplanStep,
  GameplanStepRef,
} from "@/lib/types";
import clsx from "clsx";
import {
  CircleCheckIcon,
  CircleIcon,
  FlagIcon,
  Loader2Icon,
  PlusIcon,
  ScissorsIcon,
  TriangleAlertIcon,
  ZapIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useContext, useState } from "react";
import { ToastContext } from "../context/toast.provider";

type IdeaRef = { id: number; title: string; status: string };

// What a step needs for its actions; the first step has no effort rating.
type StepFields = { title: string; detail: string; idea_id?: number | null };

// Same limit as adding a single idea.
const MAX_IDEA_DESCRIPTION_LENGTH = 500;

const EFFORT_STYLES: Record<GameplanStep["effort"], string> = {
  low: "border-green-500/40 text-green-400",
  medium: "border-yellow-500/40 text-yellow-300",
  high: "border-red-500/40 text-red-400",
};

// Adding a step as an idea calls `onLink` with the new idea's id, so the
// plan's owner can link the step to it.
export type LinkStep = (ref: GameplanStepRef, ideaId: number) => Promise<void>;

function stepKey(ref: GameplanStepRef) {
  return ref.kind === "first" ? "first" : `${ref.phase}-${ref.step}`;
}

// Checks a step off by marking its idea done (or open again).
function StepCheck({
  title,
  done,
  busy,
  onToggle,
}: {
  title: string;
  done: boolean;
  busy: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={done ? `Mark "${title}" not done` : `Mark "${title}" done`}
      aria-pressed={done}
      disabled={busy}
      onClick={onToggle}
      className="mt-0.5 shrink-0 text-white/40 hover:text-green-400/80 transition-colors hover:cursor-pointer disabled:cursor-default"
    >
      {busy ? (
        <Loader2Icon className="w-3.5 h-3.5 animate-spin" />
      ) : done ? (
        <CircleCheckIcon className="w-3.5 h-3.5 text-green-500/80" />
      ) : (
        <CircleIcon className="w-3.5 h-3.5" />
      )}
    </button>
  );
}

function DoneMark() {
  return (
    <CircleCheckIcon
      aria-label="Done"
      className="w-3 h-3 mt-1 shrink-0 text-green-500/80"
    />
  );
}

// "From your idea", or the button to make the step one.
function StepLink({
  step,
  idea,
  canAdd,
  readOnly,
  busy,
  onAdd,
}: {
  step: StepFields;
  idea?: IdeaRef;
  canAdd: boolean;
  readOnly: boolean;
  busy: boolean;
  onAdd: () => void;
}) {
  if (step.idea_id != null) {
    return (
      <span className="text-xs text-white/40">
        {readOnly ? "From the idea" : "From your idea"}
        {idea ? `: ${idea.title}` : ""}
      </span>
    );
  }
  if (!canAdd) return null;
  return (
    <button
      type="button"
      onClick={onAdd}
      disabled={busy}
      className="flex shrink-0 items-center gap-1 text-xs text-white/50 hover:text-green-400/80 transition-colors hover:cursor-pointer disabled:cursor-default disabled:opacity-60"
    >
      {busy ? (
        <Loader2Icon className="w-3 h-3 animate-spin" />
      ) : (
        <PlusIcon className="w-3 h-3" />
      )}
      Add as idea
    </button>
  );
}

function NoteList({
  title,
  icon,
  items,
}: {
  title: string;
  icon: React.ReactNode;
  items: string[];
}) {
  if (items.length === 0) return null;
  return (
    <section className="flex flex-col gap-2">
      <h3 className="flex items-center gap-2 text-sm text-white/70">
        {icon}
        {title}
      </h3>
      <ul className="flex flex-col gap-1">
        {items.map((item, index) => (
          <li key={index} className="text-sm text-white/50">
            {item}
          </li>
        ))}
      </ul>
    </section>
  );
}

// Fields arrive a few at a time while a gameplan streams, so each part
// renders once it exists.
//
// With `ideas` (the bucket's current ideas), steps show their idea and its
// done state, and can be checked off: that marks the idea done, so progress
// lives in one place. Checking an unlinked step adds it as an idea first.
// Steps can also be added as ideas in the plan's bucket; `onLink` then links
// the step to the new idea. `readOnly` leaves out both, for someone else's
// plan, but still shows which steps are done.
export function GameplanView({
  result,
  ideas,
  bucketId,
  onLink,
  readOnly = false,
}: {
  result: Partial<GameplanResult>;
  ideas?: IdeaRef[];
  bucketId?: number;
  onLink?: LinkStep;
  readOnly?: boolean;
}) {
  const router = useRouter();
  const { setToasts } = useContext(ToastContext);
  // Done states set here, shown before the refreshed ideas arrive.
  const [doneOverrides, setDoneOverrides] = useState<Record<number, boolean>>(
    {},
  );
  const [busyStep, setBusyStep] = useState<string | null>(null);

  const ideasById = new Map(ideas?.map((idea) => [idea.id, idea]));
  const targetBucket = bucketId ?? result.bucket_id;
  const canAdd = !readOnly && targetBucket != null;
  const checkable = ideas != null && canAdd;

  const ideaFor = (id?: number | null) =>
    id != null ? ideasById.get(id) : undefined;
  const isStepDone = (step: StepFields) => {
    if (step.idea_id == null) return false;
    const override = doneOverrides[step.idea_id];
    if (override !== undefined) return override;
    const idea = ideasById.get(step.idea_id);
    return idea ? isDone(idea) : false;
  };

  function toast(id: string, message: string, type: "success" | "error") {
    setToasts([{ id, message, type }]);
  }

  // Creates the step as an idea in the bucket and links the step to it.
  async function addStep(ref: GameplanStepRef, step: StepFields) {
    const response = await fetch("/api/ideas/create", {
      method: "POST",
      body: JSON.stringify({
        description: `${step.title}. ${step.detail}`.slice(
          0,
          MAX_IDEA_DESCRIPTION_LENGTH,
        ),
        bucket: targetBucket,
      }),
    });
    if (!response.ok) throw new Error("Failed to add idea");
    const [idea] = (await response.json()) as { id: number }[];
    try {
      await onLink?.(ref, idea.id);
    } catch (error) {
      console.error(error);
      toast(
        `gameplan-link-error-${step.title}`,
        "Added the idea, but couldn't link it to the plan",
        "error",
      );
    }
    return idea.id;
  }

  async function setIdeaDone(ideaId: number, done: boolean) {
    setDoneOverrides((current) => ({ ...current, [ideaId]: done }));
    const response = await fetch("/api/ideas/status", {
      method: "POST",
      body: JSON.stringify({ ideaId, done }),
    });
    if (!response.ok) {
      setDoneOverrides((current) => {
        const rest = { ...current };
        delete rest[ideaId];
        return rest;
      });
      throw new Error("Failed to update idea");
    }
  }

  async function addAsIdea(ref: GameplanStepRef, step: StepFields) {
    setBusyStep(stepKey(ref));
    try {
      await addStep(ref, step);
      toast(
        `gameplan-idea-${step.title}`,
        `"${step.title}" added to the bucket`,
        "success",
      );
      router.refresh();
    } catch (error) {
      console.error(error);
      toast(`gameplan-idea-error-${step.title}`, "Failed to add idea", "error");
    } finally {
      setBusyStep(null);
    }
  }

  async function toggleStep(ref: GameplanStepRef, step: StepFields) {
    const done = !isStepDone(step);
    setBusyStep(stepKey(ref));
    try {
      const ideaId = step.idea_id ?? (await addStep(ref, step));
      await setIdeaDone(ideaId, done);
      toast(
        `gameplan-done-${step.title}`,
        done
          ? `"${step.title}" is done. Nice work.`
          : `"${step.title}" is back on the pile`,
        "success",
      );
      router.refresh();
    } catch (error) {
      console.error(error);
      toast(
        `gameplan-done-error-${step.title}`,
        "Failed to update the step",
        "error",
      );
    } finally {
      setBusyStep(null);
    }
  }

  // The check-off button where steps can be checked; otherwise just a mark
  // for steps already done.
  function renderMark(
    ref: GameplanStepRef,
    step: StepFields,
    fallback: React.ReactNode = null,
  ) {
    const done = isStepDone(step);
    if (checkable) {
      return (
        <StepCheck
          title={step.title}
          done={done}
          busy={busyStep === stepKey(ref)}
          onToggle={() => toggleStep(ref, step)}
        />
      );
    }
    return done ? <DoneMark /> : fallback;
  }

  function renderLink(ref: GameplanStepRef, step: StepFields) {
    return (
      <StepLink
        step={step}
        idea={ideaFor(step.idea_id)}
        canAdd={canAdd}
        readOnly={readOnly}
        busy={busyStep === stepKey(ref)}
        onAdd={() => addAsIdea(ref, step)}
      />
    );
  }

  const firstRef: GameplanStepRef = { kind: "first" };
  const firstDone = result.first_step ? isStepDone(result.first_step) : false;

  // Once the first step is done, "Start today" moves on to the plan's next
  // open step. With every step done, it stays on the first one.
  const nextStep = firstDone
    ? result.phases
        ?.flatMap((phase, phaseIndex) =>
          phase.steps.map((step, stepIndex) => ({
            ref: {
              kind: "phase",
              phase: phaseIndex,
              step: stepIndex,
            } as GameplanStepRef,
            step,
            phase: `Phase ${phaseIndex + 1} · ${phase.title}`,
          })),
        )
        .find(({ step }) => !isStepDone(step))
    : undefined;
  const todayRef = nextStep?.ref ?? firstRef;
  const today = nextStep?.step ?? result.first_step;
  const todayDone = nextStep ? false : firstDone;

  return (
    <div className="flex flex-col gap-6">
      {result.finish_line && (
        <section className="flex flex-col gap-2 rounded-lg border border-white/15 border-l-2 border-l-green-500/60 bg-white/5 px-4 py-3">
          <h3 className="flex items-center gap-2 text-xs uppercase tracking-wide text-white/40">
            <FlagIcon className="w-3 h-3" />
            Finish line
          </h3>
          <p className="text-sm text-white/80">{result.finish_line}</p>
          {result.where_you_are && (
            <p className="text-sm text-white/50">{result.where_you_are}</p>
          )}
        </section>
      )}

      {result.first_step && today && (
        <div className="flex flex-col gap-2">
          {nextStep && (
            <div className="flex items-start gap-2 px-4">
              {renderMark(firstRef, result.first_step)}
              <p className="text-xs text-white/40 line-through">
                {result.first_step.title}
              </p>
            </div>
          )}
          <section className="flex flex-col gap-1 rounded-lg border border-green-500/30 px-4 py-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2">
                {renderMark(
                  todayRef,
                  today,
                  <ZapIcon className="w-3 h-3 mt-1 shrink-0 text-green-400" />,
                )}
                <div className="flex flex-col gap-0.5">
                  <h3
                    className={clsx(
                      "text-sm text-green-400",
                      todayDone && "line-through opacity-70",
                    )}
                  >
                    Start today: {today.title}
                  </h3>
                  {nextStep && (
                    <span className="text-xs text-white/40">
                      {nextStep.phase}
                    </span>
                  )}
                </div>
              </div>
              {renderLink(todayRef, today)}
            </div>
            <p className="text-sm text-white/60">{today.detail}</p>
          </section>
        </div>
      )}

      {result.phases && result.phases.length > 0 && (
        <ol className="flex flex-col gap-4">
          {result.phases.map((phase, phaseIndex) => (
            <li key={phaseIndex} className="flex flex-col gap-2">
              <div className="flex flex-col gap-0.5">
                <h3 className="text-sm">
                  <span className="text-white/40">
                    Phase {phaseIndex + 1} ·{" "}
                  </span>
                  {phase.title}
                </h3>
                <p className="text-xs text-white/50">{phase.goal}</p>
              </div>
              <ul className="flex flex-col gap-2">
                {phase.steps.map((step, stepIndex) => {
                  const ref: GameplanStepRef = {
                    kind: "phase",
                    phase: phaseIndex,
                    step: stepIndex,
                  };
                  const done = isStepDone(step);
                  return (
                    <li
                      key={stepIndex}
                      className="flex flex-col gap-1 rounded-md bg-white/5 px-3 py-2"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-2">
                          {renderMark(ref, step)}
                          <p
                            className={clsx(
                              "text-sm",
                              done && "text-white/50 line-through",
                            )}
                          >
                            {step.title}
                          </p>
                        </div>
                        <span
                          className={clsx(
                            "shrink-0 rounded-full border px-2 text-xs",
                            EFFORT_STYLES[step.effort] ??
                              "border-white/20 text-white/50",
                          )}
                        >
                          {step.effort}
                        </span>
                      </div>
                      <p className="text-xs text-white/50">{step.detail}</p>
                      <div className="flex justify-end">
                        {renderLink(ref, step)}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </li>
          ))}
        </ol>
      )}

      {Boolean(result.cut?.length || result.risks?.length) && (
        <div className="grid gap-4 md:grid-cols-2">
          <NoteList
            title="Worth cutting"
            icon={<ScissorsIcon className="w-3 h-3" />}
            items={result.cut ?? []}
          />
          <NoteList
            title="Could stall it"
            icon={<TriangleAlertIcon className="w-3 h-3" />}
            items={result.risks ?? []}
          />
        </div>
      )}
    </div>
  );
}
