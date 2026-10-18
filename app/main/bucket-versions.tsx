"use client";
import type { BucketVersion } from "@/lib/db/schema";
import { Loader2Icon, RotateCcwIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useContext, useEffect, useState } from "react";
import { ToastContext } from "../context/toast.provider";

export default function BucketVersions({ bucketId }: { bucketId: number }) {
  const router = useRouter();
  const { setToasts } = useContext(ToastContext);
  const [versions, setVersions] = useState<BucketVersion[]>([]);
  const [versionsKey, setVersionsKey] = useState(0);
  const [restoringId, setRestoringId] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/buckets/versions?bucketId=${bucketId}`)
      .then((response) => (response.ok ? response.json() : []))
      .then((data: unknown) => {
        if (!cancelled) setVersions(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        if (!cancelled) setVersions([]);
      });
    return () => {
      cancelled = true;
    };
  }, [bucketId, versionsKey]);

  async function restoreVersion(version: BucketVersion) {
    if (restoringId) return;
    setRestoringId(version.id);
    try {
      const response = await fetch("/api/buckets/versions/restore", {
        method: "POST",
        body: JSON.stringify({ versionId: version.id }),
      });
      if (!response.ok) throw new Error("Failed to restore version");
      setToasts([
        {
          id: `restored-${version.id}`,
          message: "Bucket restored. Previous state saved as a version.",
          type: "success",
        },
      ]);
      setVersionsKey((key) => key + 1);
      router.refresh();
    } catch (error) {
      console.error(error);
      setToasts([
        {
          id: `restore-error-${version.id}`,
          message: "Failed to restore version",
          type: "error",
        },
      ]);
    } finally {
      setRestoringId(null);
    }
  }

  if (versions.length === 0) return null;

  return (
    <div className="flex flex-col gap-2 p-4 border-t border-white/20">
      <p className="text-xs uppercase tracking-wide text-white/40">Versions</p>
      {versions.map((version) => (
        <div
          key={version.id}
          className="flex items-start justify-between gap-3 rounded-md bg-white/5 px-3 py-2"
        >
          <div className="flex flex-col gap-1 min-w-0">
            <p className="text-sm text-white/70">{version.name}</p>
            <p className="text-xs text-white/50 line-clamp-2">
              {version.description}
            </p>
            {version.ideas.length > 0 && (
              <ul className="flex flex-col gap-0.5 border-l border-white/15 pl-2">
                {version.ideas.map((idea) => (
                  <li key={idea.id} className="text-xs text-white/50 truncate">
                    {idea.title}
                  </li>
                ))}
              </ul>
            )}
            <p className="text-xs text-white/40">
              {new Date(version.createdAt).toLocaleString()} ·{" "}
              {version.ideas.length} idea
              {version.ideas.length === 1 ? "" : "s"}
            </p>
          </div>
          <button
            type="button"
            data-testid="restore-version"
            onClick={() => restoreVersion(version)}
            disabled={restoringId !== null}
            className="flex items-center gap-1 shrink-0 text-xs text-white/50 hover:text-white/80 transition-colors hover:cursor-pointer disabled:opacity-50"
          >
            {restoringId === version.id ? (
              <Loader2Icon className="w-3 h-3 animate-spin" />
            ) : (
              <RotateCcwIcon className="w-3 h-3" />
            )}
            Restore
          </button>
        </div>
      ))}
    </div>
  );
}
