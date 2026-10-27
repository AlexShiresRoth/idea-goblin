"use client";
import { CopyPlusIcon, Loader2Icon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

// Saves the shared bucket into the viewer's own account, or sends them to
// sign in first and back here after.
export default function SaveCopy({
  token,
  signedIn,
}: {
  token: string;
  signedIn: boolean;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!signedIn) {
    return (
      <Link
        href={`/?next=${encodeURIComponent(`/share/${token}`)}`}
        data-testid="save-copy-sign-in"
        className="action-button w-fit"
      >
        <CopyPlusIcon className="w-3 h-3" />
        Sign in to save a copy
      </Link>
    );
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/buckets/copy", {
        method: "POST",
        body: JSON.stringify({ token }),
      });
      if (!response.ok) throw new Error("Failed to save a copy");
      const { bucketId } = (await response.json()) as { bucketId: number };
      router.push(`/main/buckets/${bucketId}`);
    } catch (error) {
      console.error(error);
      setError("Couldn't save a copy. Try again?");
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        disabled={saving}
        onClick={save}
        data-testid="save-copy-button"
        className="action-button w-fit"
      >
        {saving ? (
          <Loader2Icon className="w-3 h-3 animate-spin" />
        ) : (
          <CopyPlusIcon className="w-3 h-3" />
        )}
        {saving ? "Saving..." : "Save a copy"}
      </button>
      {error && (
        <p
          role="alert"
          className="text-xs text-red-400"
          data-testid="save-copy-error"
        >
          {error}
        </p>
      )}
    </div>
  );
}
