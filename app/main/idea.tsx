"use client";
import { type IdeaVersion, type IdeaView } from "@/lib/db/schema";
import {
  Loader2Icon,
  MinusIcon,
  PencilIcon,
  PlusIcon,
  Trash2Icon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useContext, useEffect, useState } from "react";
import { ToastContext } from "../context/toast.provider";

export default function Idea({
  idea,
  subIdeas = [],
}: {
  idea: IdeaView;
  subIdeas?: IdeaView[];
}) {
  const router = useRouter();
  const { setToasts } = useContext(ToastContext);
  const [expanded, setExpanded] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [versions, setVersions] = useState<IdeaVersion[]>([]);

  useEffect(() => {
    if (!expanded) return;
    let cancelled = false;
    fetch(`/api/ideas/versions?ideaId=${idea.id}`)
      .then((response) => (response.ok ? response.json() : []))
      .then((data: IdeaVersion[]) => {
        if (!cancelled) setVersions(data);
      })
      .catch(() => {
        if (!cancelled) setVersions([]);
      });
    return () => {
      cancelled = true;
    };
  }, [expanded, idea.id]);

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
            <div className="flex flex-col w-full gap-3">
              <p className="text-sm text-white/70">{idea.description}</p>
              {subIdeas.length > 0 && (
                <div className="flex flex-col gap-1 border-l border-white/15 pl-3">
                  <p className="text-xs uppercase tracking-wide text-white/40">
                    Sub-ideas
                  </p>
                  {subIdeas.map((child) => (
                    <div key={child.id} className="flex flex-col gap-1">
                      <p className="text-sm">{child.title}</p>
                      <p className="text-sm text-white/50">{child.description}</p>
                    </div>
                  ))}
                </div>
              )}
              {versions.length > 0 && (
                <div className="flex flex-col gap-2">
                  <p className="text-xs uppercase tracking-wide text-white/40">
                    Versions
                  </p>
                  {versions.map((version) => (
                    <div
                      key={version.id}
                      className="rounded-md bg-white/5 px-3 py-2"
                    >
                      <p className="text-sm text-white/70">{version.title}</p>
                      <p className="text-xs text-white/40">
                        {new Date(version.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  ))}
                </div>
              )}
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
