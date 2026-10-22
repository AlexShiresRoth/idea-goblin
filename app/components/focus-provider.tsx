"use client";

import clsx from "clsx";
import { CrosshairIcon, Loader2Icon, XIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { createContext, useContext, useState } from "react";
import { createPortal } from "react-dom";
import { ToastContext } from "../context/toast.provider";

export type FocusBucket = { id: number; name: string; active: boolean };

type FocusValue = {
  buckets: FocusBucket[];
  limit: number;
  activeIds: number[];
  saving: boolean;
  isActive: (bucketId: number) => boolean;
  // Makes a bucket active, or opens the picker if that would pass the limit.
  workOn: (bucketId: number) => void;
  park: (bucketId: number) => void;
  openPicker: () => void;
};

const FocusContext = createContext<FocusValue | null>(null);

// Null outside a FocusProvider, where focus controls are left out.
export function useFocus() {
  return useContext(FocusContext);
}

function FocusPicker({
  buckets,
  limit,
  initial,
  saving,
  onSave,
  onClose,
}: {
  buckets: FocusBucket[];
  limit: number;
  initial: number[];
  saving: boolean;
  onSave: (bucketIds: number[]) => void;
  onClose: () => void;
}) {
  const [selected, setSelected] = useState<number[]>(initial);
  const over = selected.length - limit;

  function toggle(id: number) {
    setSelected((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id],
    );
  }

  return createPortal(
    <div className="fixed inset-0 z-1000 flex items-center justify-center bg-black/80 px-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Choose what you're working on"
        className="flex max-h-[85dvh] w-full max-w-lg flex-col gap-4 rounded-lg border border-white/20 bg-black p-6"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <h2 className="text-xl font-bold">What are you working on?</h2>
            <p className="text-sm text-white/60">
              Pick up to {limit}. The rest are parked; you can still add ideas
              to them.
            </p>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="hover:cursor-pointer"
          >
            <XIcon className="w-4 h-4" />
          </button>
        </div>

        <ul className="flex min-h-0 flex-col gap-2 overflow-y-auto">
          {buckets.map((bucket) => {
            const checked = selected.includes(bucket.id);
            return (
              <li key={bucket.id}>
                <label
                  className={clsx(
                    "flex items-center gap-3 rounded-md border px-3 py-2 text-sm transition-colors hover:cursor-pointer",
                    checked
                      ? "border-green-500/50 bg-green-500/10"
                      : "border-white/15 hover:border-white/40",
                  )}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggle(bucket.id)}
                  />
                  {bucket.name}
                </label>
              </li>
            );
          })}
        </ul>

        <div className="flex items-center justify-between gap-3 border-t border-white/20 pt-4">
          <p
            aria-live="polite"
            className={clsx(
              "text-sm",
              over > 0 ? "text-orange-400" : "text-white/60",
            )}
          >
            {over > 0
              ? `Untick ${over} to park ${over === 1 ? "it" : "them"}`
              : `${selected.length} of ${limit} picked`}
          </p>
          <button
            type="button"
            disabled={over > 0 || saving}
            onClick={() => onSave(selected)}
            className="flex items-center gap-2 rounded-md border border-white/20 px-4 py-2 text-sm transition-colors enabled:hover:cursor-pointer enabled:hover:bg-green-500 enabled:hover:text-black disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving && <Loader2Icon className="w-3 h-3 animate-spin" />}
            Save
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

// Which buckets are being worked on, for the board and every bucket on it.
export function FocusProvider({
  buckets,
  limit,
  children,
}: {
  buckets: FocusBucket[];
  limit: number;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { setToasts } = useContext(ToastContext);
  const [saving, setSaving] = useState(false);
  // The picker's starting selection while it is open.
  const [picking, setPicking] = useState<number[] | null>(null);
  const activeIds = buckets
    .filter((bucket) => bucket.active)
    .map((bucket) => bucket.id);
  const nameOf = (id: number) =>
    buckets.find((bucket) => bucket.id === id)?.name ?? "Bucket";

  async function setFocus(bucketIds: number[], message: string) {
    setSaving(true);
    try {
      const response = await fetch("/api/buckets/focus", {
        method: "POST",
        body: JSON.stringify({ bucketIds }),
      });
      if (!response.ok) throw new Error("Failed to update focus");
      setPicking(null);
      setToasts([{ id: `focus-${Date.now()}`, message, type: "success" }]);
      router.refresh();
    } catch (error) {
      console.error(error);
      setToasts([
        {
          id: `focus-error-${Date.now()}`,
          message: "Failed to update what you're working on",
          type: "error",
        },
      ]);
    } finally {
      setSaving(false);
    }
  }

  const value: FocusValue = {
    buckets,
    limit,
    activeIds,
    saving,
    isActive: (bucketId) => activeIds.includes(bucketId),
    workOn(bucketId) {
      if (activeIds.includes(bucketId)) return;
      const next = [...activeIds, bucketId];
      if (next.length > limit) {
        setPicking(next);
        return;
      }
      void setFocus(next, `Now working on "${nameOf(bucketId)}"`);
    },
    park(bucketId) {
      void setFocus(
        activeIds.filter((id) => id !== bucketId),
        `Parked "${nameOf(bucketId)}"`,
      );
    },
    openPicker: () => setPicking(activeIds),
  };

  return (
    <FocusContext.Provider value={value}>
      {children}
      {picking && (
        <FocusPicker
          buckets={buckets}
          limit={limit}
          initial={picking}
          saving={saving}
          onSave={(bucketIds) => setFocus(bucketIds, "Focus updated")}
          onClose={() => setPicking(null)}
        />
      )}
    </FocusContext.Provider>
  );
}

// "Working on: A, B · Change" above the board.
export function FocusBar() {
  const focus = useFocus();
  if (!focus || focus.buckets.length === 0) return null;
  const active = focus.buckets.filter((bucket) => bucket.active);

  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <CrosshairIcon className="w-3 h-3 text-green-400" />
      {active.length > 0 ? (
        <>
          <span className="text-white/60">Working on</span>
          {active.map((bucket) => (
            <span
              key={bucket.id}
              className="rounded-full border border-green-500/40 bg-green-500/10 px-2 py-0.5 text-xs text-green-300"
            >
              {bucket.name}
            </span>
          ))}
        </>
      ) : (
        <span className="text-white/60">
          Not working on anything yet. Pick up to {focus.limit} to focus on.
        </span>
      )}
      <button
        type="button"
        onClick={focus.openPicker}
        className="text-xs text-white/50 underline hover:cursor-pointer hover:text-white/80"
      >
        {active.length > 0 ? "Change" : "Choose"}
      </button>
    </div>
  );
}
