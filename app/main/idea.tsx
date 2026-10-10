"use client";
import { type Idea } from "@/lib/db/schema";
import {
  Loader2Icon,
  MinusIcon,
  PencilIcon,
  PlusIcon,
  SparklesIcon,
  Trash2Icon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function Idea({ idea }: { idea: Idea }) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      setError(error as string);
    } finally {
      setIsDeleting(false);
      router.refresh();
    }
  }

  return (
    <div className="flex flex-col border-b border-white/20 min-w-xl">
      <div className="flex items-center">
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
              <div className="flex flex-col">
                <p className="text-sm text-white/70">{idea.description}</p>
              </div>
            )}
          </div>
          {expanded && (
            <div className="flex justify-end gap-4 w-full p-2 border-t border-white/20">
              <button
                data-testid="analyze-idea"
                className="flex items-center gap-1 text-white/50 hover:text-yellow-500/80 transition-colors text-xs hover:cursor-pointer"
              >
                <SparklesIcon className="w-3 h-3" />
                Analyze
              </button>
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
    </div>
  );
}
