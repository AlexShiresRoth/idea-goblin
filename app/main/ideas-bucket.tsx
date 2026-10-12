"use client";
import { IdeaBucket, type IdeaView } from "@/lib/db/schema";
import clsx from "clsx";
import { Loader2Icon, SparklesIcon, Trash2Icon, XIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useContext, useState } from "react";
import { ToastContext } from "../context/toast.provider";
import IdeaComponent from "./idea";

function timeAgo(date: Date) {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const diffInMinutes = Math.floor(diff / (1000 * 60));
  const diffInHours = Math.floor(diff / (1000 * 60 * 60));
  const diffInDays = Math.floor(diff / (1000 * 60 * 60 * 24));
  const diffInSeconds = Math.floor(diff / 1000);
  return diffInDays > 0
    ? `${diffInDays}d`
    : diffInHours > 0
      ? `${diffInHours}h`
      : diffInMinutes > 0
        ? `${diffInMinutes}m`
        : `${diffInSeconds}s`;
}

export default function IdeasBucket({
  ideas,
  bucket,
}: {
  ideas: IdeaView[];
  bucket: IdeaBucket;
}) {
  const router = useRouter();
  const { setToasts } = useContext(ToastContext);
  const [expanded, setExpanded] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  async function deleteBucket(bucketId: number) {
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/buckets/delete`, {
        method: "DELETE",
        body: JSON.stringify({ bucketId }),
      });
      if (response.ok) {
        setExpanded(false);
      }
    } catch (error) {
      console.error(error);
      setToasts([
        { id: bucket.id, message: "Error deleting bucket", type: "error" },
      ]);
    } finally {
      setIsDeleting(false);
      setToasts([
        {
          id: bucket.id,
          message: `Deleted bucket: ${bucket.name}`,
          type: "success",
        },
      ]);
      router.refresh();
    }
  }

  return (
    <div
      data-idea-bucket-id={bucket.id}
      aria-label="button"
      onClick={() => !expanded && setExpanded(!expanded)}
      data-bucket-id={bucket.id}
      className={clsx(
        expanded
          ? "fixed w-screen h-screen top-0 left-0 bg-black/80 z-50 flex flex-col items-center py-8"
          : "flex bg-black flex-col gap-4 border border-white/20 rounded-lg items-start break-inside-avoid mb-2 hover:bg-black/60 hover:border-white/50 transition-colors cursor-pointer",
      )}
    >
      {expanded && (
        <div className="flex w-11/12 md:w-1/3 items-center my-2 justify-end">
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center p-2 rounded bg-white/10 text-sm hover:cursor-pointer hover:text-white/80 transition-colors"
          >
            <XIcon className="w-4 h-4" />
          </button>
        </div>
      )}
      <div
        className={clsx(
          expanded
            ? "flex flex-col w-11/12 md:w-1/3  bg-black border border-white/20 rounded-lg overflow-y-auto"
            : "",
        )}
      >
        <div className="flex flex-col gap-2">
          <div
            className={clsx(
              "flex flex-col p-4",
              expanded ? "border-b border-white/20" : "",
            )}
          >
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs text-green-500">{bucket.theme}</p>
              <p className="text-xs text-white/50">
                {timeAgo(bucket.updatedAt)}
              </p>
            </div>
            <h2 className="text-xl">{bucket.name}</h2>
            <p className="text-sm text-white/50">{bucket.description}</p>
          </div>
        </div>

        <div className={clsx(expanded ? "flex flex-col" : "hidden")}>
          {ideas.map((idea) => (
            <IdeaComponent key={idea.id} idea={idea} />
          ))}
        </div>

        {expanded && (
          <div className="flex justify-end gap-2">
            <button
              disabled={isDeleting}
              className="flex items-center gap-1 p-2 text-white/50 rounded text-sm hover:cursor-pointer hover:text-orange-300/80 transition-colors"
            >
              <SparklesIcon className="w-3 h-3" />
              Refine
            </button>
            <button
              disabled={isDeleting}
              onClick={() => !isDeleting && deleteBucket(bucket.id)}
              className="flex items-center gap-1 p-2 text-white/50 rounded text-sm hover:cursor-pointer hover:text-red-500/80 transition-colors"
            >
              <Trash2Icon className="w-3 h-3" />{" "}
              {isDeleting ? (
                <>
                  <Loader2Icon className="w-3 h-3 animate-spin" />
                  Deleting...
                </>
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
