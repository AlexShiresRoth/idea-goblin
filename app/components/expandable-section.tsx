"use client";

import clsx from "clsx";
import { ChevronDown } from "lucide-react";
import { useState } from "react";

export function ExpandableSection({
  title,
  leading,
  preview,
  defaultOpen = false,
  children,
}: {
  title: string;
  leading?: React.ReactNode;
  preview?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className="flex flex-col gap-3 min-w-0 w-full">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="flex items-center justify-between w-full min-w-0 text-left gap-3 py-2 border-b border-white/10 hover:border-white/30 transition-colors"
      >
        <div className="flex items-center gap-2 min-w-0 overflow-hidden">
          {!open && leading}
          <span className="text-sm shrink-0">{title}</span>
          {!open && preview && (
            <span className="text-sm text-white/50 truncate max-w-xl">
              {preview}
            </span>
          )}
        </div>
        <ChevronDown
          className={clsx(
            "w-3 h-3 shrink-0 text-white/50 transition-transform",
            open && "rotate-180",
          )}
        />
      </button>
      {open && children}
    </section>
  );
}
