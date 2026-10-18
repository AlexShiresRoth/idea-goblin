"use client";

import clsx from "clsx";
import { CheckIcon, Loader2, XIcon } from "lucide-react";
import { useEffect, useState } from "react";

export type AnalysisStep = {
  step: string;
  message: string;
  // When the client first saw this step, for the elapsed-time readout.
  startedAt: number;
};

// Every step before the last is done. The last one is in progress while
// `running`, failed if `failed`, and otherwise done.
export function AnalysisSteps({
  steps,
  running,
  failed = false,
}: {
  steps: AnalysisStep[];
  running: boolean;
  failed?: boolean;
}) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [running]);

  if (steps.length === 0) return null;

  return (
    <ol aria-live="polite" className="flex flex-col gap-2">
      {steps.map((item, index) => {
        const current = index === steps.length - 1;
        const active = current && running;
        const broken = current && failed && !running;
        const seconds = Math.floor((now - item.startedAt) / 1000);

        return (
          <li
            key={item.step}
            className={clsx(
              "flex items-center gap-2 text-sm animate-fade-in",
              active ? "text-white/80" : "text-white/50",
              broken && "text-red-400",
            )}
          >
            {active ? (
              <Loader2 className="w-3 h-3 animate-spin shrink-0" />
            ) : broken ? (
              <XIcon className="w-3 h-3 shrink-0" />
            ) : (
              <CheckIcon className="w-3 h-3 shrink-0 text-green-500/80" />
            )}
            <span>{item.message}</span>
            {active && seconds >= 3 && (
              <span className="text-xs text-white/30">{seconds}s</span>
            )}
          </li>
        );
      })}
    </ol>
  );
}
