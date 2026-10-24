"use client";

import { Loader2Icon, Trash2Icon, XIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useContext, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ToastContext } from "../context/toast.provider";

export function DeleteAnalysisButton({
  analysisId,
  redirectTo,
}: {
  analysisId: number;
  redirectTo?: string;
}) {
  const router = useRouter();
  const { setToasts } = useContext(ToastContext);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [canDismiss, setCanDismiss] = useState(false);

  useEffect(() => {
    if (!confirmOpen) return;
    const timeout = window.setTimeout(() => setCanDismiss(true), 250);
    return () => window.clearTimeout(timeout);
  }, [confirmOpen]);

  function openConfirm(event: React.MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    setCanDismiss(false);
    setConfirmOpen(true);
  }

  function closeConfirm() {
    if (isDeleting || !canDismiss) return;
    setConfirmOpen(false);
  }

  async function deleteAnalysis() {
    if (isDeleting) return;

    try {
      setIsDeleting(true);
      const response = await fetch("/api/analysis/delete", {
        method: "DELETE",
        body: JSON.stringify({ analysisId }),
      });

      if (!response.ok) {
        throw new Error("Failed to delete analysis");
      }

      setConfirmOpen(false);
      setToasts([
        {
          id: analysisId,
          message: "Analysis deleted",
          type: "success",
        },
      ]);

      if (redirectTo) {
        router.push(redirectTo);
      } else {
        router.refresh();
      }
    } catch (error) {
      console.error(error);
      setToasts([
        {
          id: analysisId,
          message: "Failed to delete analysis",
          type: "error",
        },
      ]);
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={openConfirm}
        disabled={isDeleting}
        className="flex items-center gap-1 text-white/50 hover:text-red-500/80 transition-colors text-sm hover:cursor-pointer disabled:cursor-not-allowed"
      >
        <Trash2Icon className="w-3 h-3" />
        Delete
      </button>
      {confirmOpen &&
        createPortal(
          <div
            className="fixed inset-0 z-2000 bg-black/70 flex items-center justify-center p-4"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) closeConfirm();
            }}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby={`delete-analysis-${analysisId}`}
              className="w-full max-w-sm rounded-lg border border-white/20 bg-black p-5 flex flex-col gap-4"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex flex-col gap-1">
                <h2
                  id={`delete-analysis-${analysisId}`}
                  className="text-lg font-bold"
                >
                  Delete this analysis?
                </h2>
                <p className="text-sm text-white/60">
                  This cannot be undone. The saved run will be removed from your
                  history.
                </p>
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  className="action-button"
                  onClick={closeConfirm}
                  disabled={isDeleting}
                >
                  <XIcon className="w-3 h-3" />
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={deleteAnalysis}
                  disabled={isDeleting}
                  className="flex items-center gap-1 rounded-md border border-red-500/40 px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 hover:cursor-pointer disabled:cursor-not-allowed"
                >
                  {isDeleting ? (
                    <Loader2Icon className="w-3 h-3 animate-spin" />
                  ) : (
                    <Trash2Icon className="w-3 h-3" />
                  )}
                  {isDeleting ? "Deleting..." : "Delete"}
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
