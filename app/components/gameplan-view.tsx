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

function AddAsIdea({
  bucketId,
  title,
  detail,
  stepRef,
  onLink,
}: {
  bucketId: number;
  title: string;
  detail: string;
  stepRef: GameplanStepRef;
  onLink?: LinkStep;
}) {
  const router = useRouter();
  const { setToasts } = useContext(ToastContext);
  const [adding, setAdding] = useState(false);

  async function add() {
    setAdding(true);
    try {
      const response = await fetch("/api/ideas/create", {
        method: "POST",
        body: JSON.stringify({
          description: `${title}. ${detail}`.slice(
            0,
            MAX_IDEA_DESCRIPTION_LENGTH,
          ),
          bucket: bucketId,
        }),
      });
      if (!response.ok) throw new Error("Failed to add idea");
      const [idea] = (await response.json()) as { id: number }[];
      setToasts([
        {
          id: `gameplan-idea-${title}`,
          message: `"${title}" added to the bucket`,
          type: "success",
        },
      ]);
      router.refresh();
      try {
        await onLink?.(stepRef, idea.id);
      } catch (error) {
        console.error(error);
        setToasts([
          {
            id: `gameplan-link-error-${title}`,
            message: "Added the idea, but couldn't link it to the plan",
            type: "error",
          },
        ]);
      }
    } catch (error) {
      console.error(error);
      setToasts([
        {
          id: `gameplan-idea-error-${title}`,
          message: "Failed to add idea",
          type: "error",
        },
      ]);
    } finally {
      setAdding(false);
    }
  }

  return (
    <button
      type="button"
      onClick={add}
      disabled={adding}
      className="flex shrink-0 items-center gap-1 text-xs text-white/50 hover:text-green-400/80 transition-colors hover:cursor-pointer disabled:cursor-default disabled:opacity-60"
    >
      {adding ? (
        <Loader2Icon className="w-3 h-3 animate-spin" />
      ) : (
        <PlusIcon className="w-3 h-3" />
      )}
      Add as idea
    </button>
  );
}

// "From your idea", or the button to make the step one.
function StepLink({
  ideaId,
  idea,
  bucketId,
  title,
  detail,
  stepRef,
  onLink,
}: {
  ideaId?: number | null;
  idea?: IdeaRef;
  bucketId?: number;
  title: string;
  detail: string;
  stepRef: GameplanStepRef;
  onLink?: LinkStep;
}) {
  if (ideaId != null) {
    return (
      <span className="text-xs text-white/40">
        From your idea{idea ? `: ${idea.title}` : ""}
      </span>
    );
  }
  if (bucketId == null) return null;
  return (
    <AddAsIdea
      bucketId={bucketId}
      title={title}
      detail={detail}
      stepRef={stepRef}
      onLink={onLink}
    />
  );
}

function DoneMark() {
  return (
    <CircleCheckIcon
      aria-label="Done"
      className="w-3 h-3 shrink-0 text-green-500/80"
    />
  );
}

function StepItem({
  step,
  idea,
  bucketId,
  stepRef,
  onLink,
}: {
  step: GameplanStep;
  idea?: IdeaRef;
  bucketId?: number;
  stepRef: GameplanStepRef;
  onLink?: LinkStep;
}) {
  const done = idea ? isDone(idea) : false;

  return (
    <li className="flex flex-col gap-1 rounded-md bg-white/5 px-3 py-2">
      <div className="flex items-start justify-between gap-3">
        <p
          className={clsx(
            "flex items-center gap-2 text-sm",
            done && "text-white/50 line-through",
          )}
        >
          {done && <DoneMark />}
          {step.title}
        </p>
        <span
          className={clsx(
            "shrink-0 rounded-full border px-2 text-xs",
            EFFORT_STYLES[step.effort] ?? "border-white/20 text-white/50",
          )}
        >
          {step.effort}
        </span>
      </div>
      <p className="text-xs text-white/50">{step.detail}</p>
      <div className="flex justify-end">
        <StepLink
          ideaId={step.idea_id}
          idea={idea}
          bucketId={bucketId}
          title={step.title}
          detail={step.detail}
          stepRef={stepRef}
          onLink={onLink}
        />
      </div>
    </li>
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
// renders once it exists. With `ideas`, steps from existing ideas show the
// idea and whether it is done. Other steps can be added as ideas in the
// plan's bucket; `onLink` then links the step to the new idea.
export function GameplanView({
  result,
  ideas,
  bucketId,
  onLink,
}: {
  result: Partial<GameplanResult>;
  ideas?: IdeaRef[];
  bucketId?: number;
  onLink?: LinkStep;
}) {
  const ideasById = new Map(ideas?.map((idea) => [idea.id, idea]));
  const targetBucket = bucketId ?? result.bucket_id;
  const ideaFor = (id?: number | null) =>
    id != null ? ideasById.get(id) : undefined;
  const firstIdea = ideaFor(result.first_step?.idea_id);
  const firstDone = firstIdea ? isDone(firstIdea) : false;

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

      {result.first_step && (
        <section className="flex flex-col gap-1 rounded-lg border border-green-500/30 px-4 py-3">
          <div className="flex items-start justify-between gap-3">
            <h3
              className={clsx(
                "flex items-center gap-2 text-sm text-green-400",
                firstDone && "line-through opacity-70",
              )}
            >
              {firstDone ? <DoneMark /> : <ZapIcon className="w-3 h-3" />}
              Start today: {result.first_step.title}
            </h3>
            <StepLink
              ideaId={result.first_step.idea_id}
              idea={firstIdea}
              bucketId={targetBucket}
              title={result.first_step.title}
              detail={result.first_step.detail}
              stepRef={{ kind: "first" }}
              onLink={onLink}
            />
          </div>
          <p className="text-sm text-white/60">{result.first_step.detail}</p>
        </section>
      )}

      {result.phases && result.phases.length > 0 && (
        <ol className="flex flex-col gap-4">
          {result.phases.map((phase, index) => (
            <li key={index} className="flex flex-col gap-2">
              <div className="flex flex-col gap-0.5">
                <h3 className="text-sm">
                  <span className="text-white/40">Phase {index + 1} · </span>
                  {phase.title}
                </h3>
                <p className="text-xs text-white/50">{phase.goal}</p>
              </div>
              <ul className="flex flex-col gap-2">
                {phase.steps.map((step, stepIndex) => (
                  <StepItem
                    key={stepIndex}
                    step={step}
                    idea={ideaFor(step.idea_id)}
                    bucketId={targetBucket}
                    stepRef={{ kind: "phase", phase: index, step: stepIndex }}
                    onLink={onLink}
                  />
                ))}
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
