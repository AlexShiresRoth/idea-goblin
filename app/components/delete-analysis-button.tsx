"use client";

import { Loader2Icon, Trash2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useContext, useState } from "react";
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
  const [isDeleting, setIsDeleting] = useState(false);

  async function deleteAnalysis(event: React.MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
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
    <button
      type="button"
      onClick={deleteAnalysis}
      disabled={isDeleting}
      className="flex items-center gap-1 text-white/50 hover:text-red-500/80 transition-colors text-sm hover:cursor-pointer disabled:cursor-not-allowed"
    >
      {isDeleting ? (
        <Loader2Icon className="w-3 h-3 animate-spin" />
      ) : (
        <Trash2Icon className="w-3 h-3" />
      )}
      {isDeleting ? "Deleting..." : "Delete"}
    </button>
  );
}
