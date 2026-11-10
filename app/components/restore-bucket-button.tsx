"use client";

import { Loader2, RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useContext, useId, useRef, useState } from "react";
import { ToastContext } from "../context/toast.provider";

export function RestoreBucketButton({ bucketId }: { bucketId: number }) {
  const router = useRouter();
  const { setToasts } = useContext(ToastContext);
  const inFlight = useRef(false);
  const errorId = useId();
  const [pending, setPending] = useState(false);
  const [restored, setRestored] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function restore() {
    if (inFlight.current || restored) return;
    inFlight.current = true;
    setPending(true);
    setError(null);

    try {
      const response = await fetch("/api/buckets/restore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bucketId }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(
          body?.error || "Failed to restore bucket. Please try again.",
        );
      }

      setRestored(true);
      setToasts([
        {
          id: bucketId,
          message: body?.message || "Bucket restored successfully",
          type: "success",
        },
      ]);
      router.refresh();
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Failed to restore bucket. Please try again.",
      );
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-2 shrink-0 sm:max-w-xs">
      <button
        type="button"
        onClick={restore}
        disabled={pending || restored}
        aria-busy={pending}
        aria-describedby={error ? errorId : undefined}
        className="action-button text-accent rounded-none disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending ? (
          <Loader2 className="w-3 h-3 animate-spin" aria-hidden="true" />
        ) : (
          <RotateCcw className="w-3 h-3" aria-hidden="true" />
        )}
        {pending ? "Restoring..." : restored ? "Restored" : "Restore"}
      </button>
      {error && (
        <p id={errorId} role="alert" className="text-sm text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}
