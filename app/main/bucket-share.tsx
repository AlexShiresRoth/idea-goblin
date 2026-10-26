"use client";
import {
  CopyIcon,
  Link2Icon,
  Loader2Icon,
  RefreshCwIcon,
  Share2Icon,
  XIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useContext, useState } from "react";
import { createPortal } from "react-dom";
import { ToastContext } from "../context/toast.provider";

type ShareAction = "enable" | "regenerate" | "disable";

function shareUrl(token: string) {
  return `${window.location.origin}/share/${token}`;
}

// Turns the bucket's read-only share link on or off, and copies it.
export default function BucketShare({
  bucketId,
  shareToken,
}: {
  bucketId: number;
  shareToken: string | null;
}) {
  const router = useRouter();
  const { setToasts } = useContext(ToastContext);
  const [open, setOpen] = useState(false);
  const [token, setToken] = useState(shareToken);
  const [busy, setBusy] = useState<ShareAction | null>(null);

  async function share(action: ShareAction) {
    setBusy(action);
    try {
      const response = await fetch("/api/buckets/share", {
        method: "POST",
        body: JSON.stringify({ bucketId, action }),
      });
      if (!response.ok) throw new Error("Failed to update sharing");
      const body = (await response.json()) as { shareToken: string | null };
      setToken(body.shareToken);
      router.refresh();
    } catch (error) {
      console.error(error);
      setToasts([
        {
          id: `share-error-${bucketId}`,
          message: "Failed to update the share link",
          type: "error",
        },
      ]);
    } finally {
      setBusy(null);
    }
  }

  async function copy() {
    if (!token) return;
    try {
      await navigator.clipboard.writeText(shareUrl(token));
      setToasts([
        {
          id: `share-copied-${bucketId}`,
          message: "Link copied",
          type: "success",
        },
      ]);
    } catch (error) {
      console.error(error);
      setToasts([
        {
          id: `share-copy-error-${bucketId}`,
          message: "Couldn't copy the link",
          type: "error",
        },
      ]);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1 p-2 text-white/50 rounded text-sm hover:cursor-pointer hover:text-sky-300/80 transition-colors"
      >
        <Share2Icon className="w-3 h-3" />
        {token ? "Shared" : "Share"}
      </button>
      {open &&
        createPortal(
          <div className="fixed inset-0 z-1000 flex items-center justify-center bg-black/80 px-4">
            <div
              role="dialog"
              aria-modal="true"
              aria-label="Share this bucket"
              className="flex w-full max-w-lg flex-col gap-4 rounded-lg border border-white/20 bg-black p-6"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex flex-col gap-1">
                  <h2 className="text-xl font-bold">Share this bucket</h2>
                  <p className="text-sm text-white/60">
                    Anyone with the link can see its ideas and latest gameplan,
                    without signing in. They can&apos;t change anything.
                  </p>
                </div>
                <button
                  type="button"
                  aria-label="Close"
                  onClick={() => setOpen(false)}
                  className="hover:cursor-pointer"
                >
                  <XIcon className="w-4 h-4" />
                </button>
              </div>

              {token ? (
                <>
                  <div className="flex gap-2">
                    <input
                      readOnly
                      aria-label="Share link"
                      value={shareUrl(token)}
                      onFocus={(event) => event.target.select()}
                      className="min-w-0 flex-1 rounded border border-white/20 bg-white/5 px-2 py-1 text-sm text-white/80"
                    />
                    <button
                      type="button"
                      onClick={copy}
                      className="action-button"
                    >
                      <CopyIcon className="w-3 h-3" />
                      Copy
                    </button>
                  </div>
                  <div className="flex flex-wrap justify-end gap-4">
                    <button
                      type="button"
                      disabled={busy != null}
                      onClick={() => share("regenerate")}
                      title="Links already sent stop working"
                      className="flex items-center gap-1 text-xs text-white/50 hover:cursor-pointer hover:text-white/80 transition-colors disabled:opacity-50"
                    >
                      {busy === "regenerate" ? (
                        <Loader2Icon className="w-3 h-3 animate-spin" />
                      ) : (
                        <RefreshCwIcon className="w-3 h-3" />
                      )}
                      New link
                    </button>
                    <button
                      type="button"
                      disabled={busy != null}
                      onClick={() => share("disable")}
                      className="flex items-center gap-1 text-xs text-white/50 hover:cursor-pointer hover:text-red-500/80 transition-colors disabled:opacity-50"
                    >
                      {busy === "disable" ? (
                        <Loader2Icon className="w-3 h-3 animate-spin" />
                      ) : (
                        <XIcon className="w-3 h-3" />
                      )}
                      Stop sharing
                    </button>
                  </div>
                  <p className="text-xs text-white/40">
                    A new link or stopping sharing makes links you&apos;ve
                    already sent stop working.
                  </p>
                </>
              ) : (
                <button
                  type="button"
                  disabled={busy != null}
                  onClick={() => share("enable")}
                  className="action-button w-fit"
                >
                  {busy === "enable" ? (
                    <Loader2Icon className="w-3 h-3 animate-spin" />
                  ) : (
                    <Link2Icon className="w-3 h-3" />
                  )}
                  Create link
                </button>
              )}
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
