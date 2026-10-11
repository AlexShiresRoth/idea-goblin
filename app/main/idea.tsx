"use client";
import { type IdeaView } from "@/lib/db/schema";
import {
  Loader2Icon,
  MinusIcon,
  PencilIcon,
  PlusIcon,
  Trash2Icon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useContext, useState } from "react";
import { ToastContext } from "../context/toast.provider";

export default function Idea({ idea }: { idea: IdeaView }) {
  const router = useRouter();
  const { setToasts } = useContext(ToastContext);
  const [expanded, setExpanded] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  async function deleteIdea(ideaId: number) {
    try {
      setIsDeleting(true);

      const response = await fetch("/api/ideas/delete", {
        method: "DELETE",
        body: JSON.stringify({ ideaId }),
      });

      if (!response.ok) {
        throw new Error("Failed to delete idea");
      }

      return response.json();
    } catch (error) {
      console.error(error);
      setToasts([
        { id: idea.id, message: "Failed to delete idea", type: "error" },
      ]);
    } finally {
      setIsDeleting(false);
      setToasts([
        {
          id: idea.id,
          message: `Deleted idea: ${idea.title}`,
          type: "success",
        },
      ]);
      router.refresh();
    }
  }

  return (
    <div className="flex border-b border-white/20 w-full">
      <button
        data-testid="toggle-expanded"
        onClick={() => setExpanded(!expanded)}
        className="hover:cursor-pointer hover:bg-white/5 transition-colors p-2 border-r border-white/20 h-full"
      >
        {!expanded ? (
          <PlusIcon className="w-4 h-4" />
        ) : (
          <MinusIcon className="w-4 h-4" />
        )}
      </button>

      <div className="flex flex-col w-full">
        <div
          aria-label="idea-content"
          role="button"
          className="flex flex-col p-4 gap-2 w-full hover:cursor-pointer hover:bg-white/5 transition-colors"
          onClick={() => setExpanded(!expanded)}
        >
          <p className="text-sm">{idea.title}</p>
          {expanded && (
            <div className="flex flex-col w-full">
              <p className="text-sm text-white/70">{idea.description}</p>
            </div>
          )}
        </div>
        {expanded && (
          <div className="flex justify-end gap-4 p-2 border-t border-white/20">
            <button
              data-testid="edit-idea"
              className="flex items-center gap-1 text-white/50 hover:text-blue-500/80 transition-colors text-xs hover:cursor-pointer"
            >
              <PencilIcon className="w-3 h-3" />
              Edit
            </button>
            <button
              data-testid="delete-idea"
              className="flex items-center gap-1 text-white/50 hover:text-red-500/80 transition-colors text-xs hover:cursor-pointer"
              onClick={() => !isDeleting && deleteIdea(idea.id)}
              disabled={isDeleting}
            >
              <Trash2Icon className="w-3 h-3" />
              {isDeleting ? (
                <Loader2Icon className="w-3 h-3 animate-spin" />
              ) : (
                "Delete"
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
