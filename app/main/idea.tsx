"use client";
import { isDone } from "@/lib/constants";
import { type IdeaView } from "@/lib/db/schema";
import clsx from "clsx";
import {
  CheckIcon,
  CircleCheckIcon,
  Loader2Icon,
  MinusIcon,
  PencilIcon,
  PlusIcon,
  RotateCcwIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useContext, useState } from "react";
import { ToastContext } from "../context/toast.provider";

const fieldClassName =
  "block w-full rounded-md border focus:outline-none border-white/10 bg-white/10 px-3 py-2 text-sm text-white focus:border-white/50";

export default function Idea({ idea }: { idea: IdeaView }) {
  const router = useRouter();
  const { setToasts } = useContext(ToastContext);
  const [expanded, setExpanded] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [editing, setEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isMarking, setIsMarking] = useState(false);
  const done = isDone(idea);
  const [title, setTitle] = useState(idea.title);
  const [description, setDescription] = useState(idea.description);

  function startEditing() {
    setTitle(idea.title);
    setDescription(idea.description);
    setEditing(true);
  }

  async function saveIdea(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!title.trim() || !description.trim()) {
      setToasts([
        {
          id: idea.id,
          message: "Title and description are required",
          type: "error",
        },
      ]);
      return;
    }
    setIsSaving(true);
    try {
      const response = await fetch("/api/ideas/update", {
        method: "POST",
        body: JSON.stringify({ ideaId: idea.id, title, description }),
      });
      if (!response.ok) {
        throw new Error("Failed to update idea");
      }
      setEditing(false);
      setToasts([{ id: idea.id, message: "Idea updated", type: "success" }]);
      router.refresh();
    } catch (error) {
      console.error(error);
      setToasts([
        { id: idea.id, message: "Failed to update idea", type: "error" },
      ]);
    } finally {
      setIsSaving(false);
    }
  }

  async function deleteIdea(ideaId: number) {
    setIsDeleting(true);
    try {
      const response = await fetch("/api/ideas/delete", {
        method: "DELETE",
        body: JSON.stringify({ ideaId }),
      });
      if (!response.ok) {
        throw new Error("Failed to delete idea");
      }
      setToasts([
        {
          id: idea.id,
          message: `Deleted "${idea.title}". Off to the rubbish heap.`,
          type: "success",
        },
      ]);
      router.refresh();
    } catch (error) {
      console.error(error);
      setToasts([
        { id: idea.id, message: "Failed to delete idea", type: "error" },
      ]);
    } finally {
      setIsDeleting(false);
    }
  }

  async function toggleDone() {
    setIsMarking(true);
    try {
      const response = await fetch("/api/ideas/status", {
        method: "POST",
        body: JSON.stringify({ ideaId: idea.id, done: !done }),
      });
      if (!response.ok) {
        throw new Error("Failed to update idea");
      }
      setToasts([
        {
          id: idea.id,
          message: done
            ? `"${idea.title}" is back on the pile`
            : `"${idea.title}" is done. Nice work.`,
          type: "success",
        },
      ]);
      router.refresh();
    } catch (error) {
      console.error(error);
      setToasts([
        { id: idea.id, message: "Failed to update idea", type: "error" },
      ]);
    } finally {
      setIsMarking(false);
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
        {editing ? (
          <form className="flex flex-col p-4 gap-2 w-full" onSubmit={saveIdea}>
            <input
              aria-label="Idea title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={200}
              required
              className={fieldClassName}
            />
            <textarea
              aria-label="Idea description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={500}
              rows={4}
              required
              className={fieldClassName}
            />
            <div className="flex justify-end gap-4">
              <button
                type="button"
                onClick={() => setEditing(false)}
                disabled={isSaving}
                className="flex items-center gap-1 text-white/50 hover:text-white/80 transition-colors text-xs hover:cursor-pointer"
              >
                <XIcon className="w-3 h-3" />
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="flex items-center gap-1 text-white/50 hover:text-green-400/80 transition-colors text-xs hover:cursor-pointer disabled:opacity-50"
              >
                {isSaving ? (
                  <Loader2Icon className="w-3 h-3 animate-spin" />
                ) : (
                  <CheckIcon className="w-3 h-3" />
                )}
                Save
              </button>
            </div>
          </form>
        ) : (
          <div
            aria-label="idea-content"
            role="button"
            className="flex flex-col p-4 gap-2 w-full hover:cursor-pointer hover:bg-white/5 transition-colors"
            onClick={() => setExpanded(!expanded)}
          >
            <p
              className={clsx(
                "flex items-center gap-2 text-sm",
                done && "text-white/50 line-through",
              )}
            >
              {done && (
                <CircleCheckIcon
                  aria-label="Done"
                  className="w-3 h-3 shrink-0 text-green-500/80"
                />
              )}
              {idea.title}
            </p>
            {expanded && (
              <div className="flex flex-col w-full gap-3">
                <p className="text-sm text-white/70">{idea.description}</p>
              </div>
            )}
          </div>
        )}
        {expanded && !editing && (
          <div className="flex justify-end gap-4 p-2 border-t border-white/20">
            <button
              data-testid="toggle-done"
              onClick={() => !isMarking && toggleDone()}
              disabled={isMarking}
              className="flex items-center gap-1 text-white/50 hover:text-green-400/80 transition-colors text-xs hover:cursor-pointer disabled:opacity-50"
            >
              {isMarking ? (
                <Loader2Icon className="w-3 h-3 animate-spin" />
              ) : done ? (
                <RotateCcwIcon className="w-3 h-3" />
              ) : (
                <CircleCheckIcon className="w-3 h-3" />
              )}
              {done ? "Not done" : "Done"}
            </button>
            <button
              data-testid="edit-idea"
              onClick={startEditing}
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
