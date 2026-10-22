"use client";

import type { ImportSummary, ImportTarget } from "@/lib/import/schema";
import { readNdjson } from "@/lib/ndjson";
import type { BucketChoice, BucketOption } from "@/lib/types";
import clsx from "clsx";
import { PlusIcon, XIcon } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useContext, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ToastContext } from "../context/toast.provider";
import ActionButton from "./action-button";
import { CharCounter } from "./char-counter";

function Label({
  children,
  htmlFor,
}: {
  children: React.ReactNode;
  htmlFor: string;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className="block text-sm font-medium text-white/80"
    >
      {children}
    </label>
  );
}

const fieldClassName =
  "mt-1 block w-full rounded-md border focus:outline-none border-white/10 bg-white/10 px-3 py-2 text-sm text-white placeholder:text-white/50 focus:border-white/50 focus:ring-white/50";

function BucketSelect({
  value,
  onChange,
  buckets,
  loading,
}: {
  value: BucketChoice;
  onChange: (value: BucketChoice) => void;
  buckets: BucketOption[];
  loading: boolean;
}) {
  return (
    <select
      id="bucket"
      name="bucket"
      value={String(value)}
      onChange={(e) => {
        const next = e.target.value;
        onChange(next === "auto" || next === "new" ? next : Number(next));
      }}
      className={fieldClassName}
    >
      <option value="auto">Let the Goblin decide</option>
      <option value="new">New bucket</option>
      {loading && <option disabled>Loading buckets...</option>}
      {buckets.length > 0 && (
        <optgroup label="Your buckets">
          {buckets.map((bucket) => (
            <option key={bucket.id} value={bucket.id}>
              {bucket.name}
            </option>
          ))}
        </optgroup>
      )}
    </select>
  );
}

function Button({
  children,
  type,
  isLoading,
  disabled,
}: {
  children: React.ReactNode;
  type: "button" | "submit";
  isLoading?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type={type}
      disabled={isLoading || disabled}
      className="bg-green-500 text-sm text-black font-semibold rounded p-2 shadow-md hover:bg-green-600 transition-colors hover:cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {children}
    </button>
  );
}

// Ideas one form can add at once; longer lists belong in Import.
const MAX_IDEAS_PER_FORM = 10;
const MAX_TITLE_LENGTH = 200;
const MAX_DESCRIPTION_LENGTH = 500;
const MIN_DESCRIPTION_LENGTH = 3;

type IdeaDraft = { key: number; title: string; description: string };

const emptyDraft = (key: number): IdeaDraft => ({
  key,
  title: "",
  description: "",
});

function CreateIdeaForm({
  onClose,
  defaultBucket = "auto",
}: {
  onClose: () => void;
  defaultBucket?: BucketChoice;
}) {
  const { setToasts } = useContext(ToastContext);
  const router = useRouter();
  const pathname = usePathname();
  const [drafts, setDrafts] = useState<IdeaDraft[]>([emptyDraft(0)]);
  const nextKey = useRef(1);
  const [isLoading, setIsLoading] = useState(false);
  const [bucket, setBucket] = useState<BucketChoice>(defaultBucket);
  const [bucketName, setBucketName] = useState("");
  const [buckets, setBuckets] = useState<BucketOption[]>([]);
  const [bucketsLoading, setBucketsLoading] = useState(true);

  // Rows left completely empty are ignored.
  const filled = drafts.filter(
    (draft) => draft.title.trim() || draft.description.trim(),
  );
  const many = filled.length > 1;
  // A new bucket for one idea can borrow its title; several need a name.
  const needsBucketName = many && bucket === "new" && !bucketName.trim();

  useEffect(() => {
    let cancelled = false;
    fetch("/api/buckets/list")
      .then((response) => (response.ok ? response.json() : []))
      .then((data: BucketOption[]) => {
        if (!cancelled) setBuckets(data);
      })
      .catch((error) => console.error(error))
      .finally(() => {
        if (!cancelled) setBucketsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function updateDraft(key: number, change: Partial<IdeaDraft>) {
    setDrafts((current) =>
      current.map((draft) =>
        draft.key === key ? { ...draft, ...change } : draft,
      ),
    );
  }

  function addDraft() {
    setDrafts((current) => [...current, emptyDraft(nextKey.current++)]);
  }

  function removeDraft(key: number) {
    setDrafts((current) => current.filter((draft) => draft.key !== key));
  }

  function toast(id: string, message: string, type: "success" | "error") {
    setToasts([{ id, message, type }]);
  }

  async function createOne(draft: IdeaDraft) {
    const title = draft.title.trim();
    const response = await fetch("/api/ideas/create", {
      method: "POST",
      body: JSON.stringify({
        description: draft.description.trim(),
        ...(title && { title }),
        bucket,
        bucketName: bucket === "new" ? bucketName.trim() : undefined,
      }),
    });
    if (!response.ok) throw new Error("Failed to create idea");
  }

  // Several ideas go through the batched import, which names, embeds and
  // sorts them in a few calls. They were typed on purpose, so lookalikes of
  // existing ideas are kept.
  async function createMany(ideas: IdeaDraft[]) {
    const target: ImportTarget =
      bucket === "auto"
        ? { type: "auto" }
        : bucket === "new"
          ? { type: "named", name: bucketName.trim() }
          : { type: "existing", bucketId: bucket };
    const response = await fetch("/api/ideas/import", {
      method: "POST",
      body: JSON.stringify({
        rows: ideas.map((draft) => {
          const title = draft.title.trim();
          return {
            ...(title && { title }),
            description: draft.description.trim(),
            target,
          };
        }),
        allowDuplicates: true,
      }),
    });
    if (!response.ok) {
      throw new Error(
        response.status === 429
          ? await response.text()
          : "Failed to create ideas",
      );
    }
    let created: number | null = null;
    let failure: string | null = null;
    await readNdjson<{
      type: string;
      data?: ImportSummary;
      message?: string;
    }>(response, (event) => {
      if (event.type === "done" && event.data) created = event.data.created;
      if (event.type === "error") failure = event.message ?? null;
    });
    if (created === null) throw new Error(failure ?? "Failed to create ideas");
    return created;
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (
      filled.length === 0 ||
      filled.some(
        (draft) => draft.description.trim().length < MIN_DESCRIPTION_LENGTH,
      )
    ) {
      toast(
        "description-required",
        many ? "Each idea needs a description" : "Description is required",
        "error",
      );
      return;
    }
    if (needsBucketName) return;

    setIsLoading(true);
    try {
      let message = "Idea added to the hoard";
      if (many) {
        const created = await createMany(filled);
        message = `Added ${created} idea${created === 1 ? "" : "s"} to the hoard`;
      } else {
        await createOne(filled[0]);
      }
      toast("idea-created", message, "success");
      // Only close once saved, so a failure keeps what was typed.
      onClose();
      if (pathname.split("/").pop() !== "main") {
        router.push("/main");
      } else {
        router.refresh();
      }
    } catch (error) {
      console.error(error);
      toast(
        "failed-to-create-idea",
        error instanceof Error && error.message.startsWith("The Goblin")
          ? error.message
          : many
            ? "Failed to create ideas"
            : "Failed to create idea",
        "error",
      );
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="flex max-h-[90dvh] w-11/12 flex-col rounded-lg border border-white/20 bg-black p-4 md:w-1/3">
      <div className="flex justify-between items-center border-b border-white/20 pb-4">
        <h2 className="text-2xl font-bold">
          {drafts.length > 1 ? "New Ideas" : "New Idea"}
        </h2>
        <button onClick={onClose} className="hover:cursor-pointer">
          <XIcon className="w-4 h-4" />
        </button>
      </div>
      <form className="flex min-h-0 flex-col gap-4" onSubmit={handleSubmit}>
        <div className="flex min-h-0 flex-col gap-4 overflow-y-auto pr-1 pt-2">
          {drafts.map((draft, index) => {
            const first = index === 0;
            const n = index + 1;
            return (
              <div
                key={draft.key}
                className={clsx(
                  "flex flex-col gap-2",
                  !first && "border-t border-white/10 pt-4",
                )}
              >
                {drafts.length > 1 && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-white/50">Idea {n}</span>
                    <button
                      type="button"
                      aria-label={`Remove idea ${n}`}
                      onClick={() => removeDraft(draft.key)}
                      className="text-white/50 hover:text-white/80 hover:cursor-pointer"
                    >
                      <XIcon className="w-3 h-3" />
                    </button>
                  </div>
                )}
                {first && <Label htmlFor="title-0">Title (optional)</Label>}
                <input
                  id={first ? "title-0" : undefined}
                  aria-label={first ? undefined : `Idea ${n} title (optional)`}
                  value={draft.title}
                  onChange={(e) =>
                    updateDraft(draft.key, { title: e.target.value })
                  }
                  maxLength={MAX_TITLE_LENGTH}
                  placeholder="Leave blank and the Goblin names it"
                  className={fieldClassName}
                />
                {first && (
                  <Label htmlFor="description">What&apos;s your idea?</Label>
                )}
                <div className="relative">
                  <textarea
                    id={first ? "description" : undefined}
                    aria-label={first ? undefined : `Idea ${n} description`}
                    value={draft.description}
                    onChange={(e) =>
                      updateDraft(draft.key, { description: e.target.value })
                    }
                    maxLength={MAX_DESCRIPTION_LENGTH}
                    rows={first && drafts.length === 1 ? 5 : 3}
                    className="block w-full rounded-md border focus:outline-none border-white/10 bg-white/10 px-3 py-1 text-white placeholder:text-white/50 focus:border-white/50 focus:ring-white/50"
                  />
                  <CharCounter
                    valueLength={draft.description.length}
                    maxLength={MAX_DESCRIPTION_LENGTH}
                    className="absolute bottom-2 right-2"
                  />
                </div>
              </div>
            );
          })}
        </div>

        {drafts.length < MAX_IDEAS_PER_FORM ? (
          <button
            type="button"
            onClick={addDraft}
            className="flex w-fit items-center gap-1 text-sm text-white/60 hover:text-green-400/80 hover:cursor-pointer"
          >
            <PlusIcon className="w-3 h-3" />
            Add another idea
          </button>
        ) : (
          <p className="text-xs text-white/50">
            That&apos;s {MAX_IDEAS_PER_FORM} at once. For longer lists, use
            Import.
          </p>
        )}

        <div className="flex flex-col gap-2">
          <Label htmlFor="bucket">Bucket</Label>
          <BucketSelect
            value={bucket}
            onChange={setBucket}
            buckets={buckets}
            loading={bucketsLoading}
          />
          {bucket === "new" && (
            <input
              id="bucket-name"
              name="bucket-name"
              value={bucketName}
              onChange={(e) => setBucketName(e.target.value)}
              maxLength={100}
              placeholder={
                many
                  ? "Bucket name"
                  : "Bucket name (defaults to the idea's title)"
              }
              aria-label="New bucket name"
              className={fieldClassName}
            />
          )}
        </div>

        <div className="flex justify-end">
          <Button
            type="submit"
            isLoading={isLoading}
            disabled={needsBucketName}
          >
            {isLoading
              ? "Creating..."
              : many
                ? `Create ${filled.length} ideas`
                : "Create Idea"}
          </Button>
        </div>
      </form>
    </div>
  );
}

export default function CreateIdeaModal({
  type,
  onTrigger,
  defaultBucket,
}: {
  type: "floating" | "inline" | "menu" | "bucket";
  onTrigger?: () => void;
  defaultBucket?: BucketChoice;
}) {
  const [isOpen, setIsOpen] = useState(false);

  function openModal() {
    onTrigger?.();
    setIsOpen(true);
  }

  return (
    <div>
      {type === "inline" && (
        <ActionButton action={openModal}>
          <PlusIcon className="w-3 h-3" />
          <span>New Idea</span>
        </ActionButton>
      )}
      {type === "menu" && (
        <button
          type="button"
          onClick={openModal}
          className="flex items-center gap-2 text-sm w-full rounded-md border border-white/15 bg-black px-4 py-3 text-white/80"
        >
          <PlusIcon className="w-3 h-3" />
          New Idea
        </button>
      )}
      {type === "bucket" && (
        <button
          type="button"
          onClick={openModal}
          className="flex items-center gap-1 p-2 text-white/50 rounded text-sm hover:cursor-pointer hover:text-green-400/80 transition-colors"
        >
          <PlusIcon className="w-3 h-3" />
          Add
        </button>
      )}
      {!isOpen && type === "floating" && (
        <button
          onClick={openModal}
          className="hidden md:block fixed bottom-12 md:bottom-15 right-5 md:right-15 bg-green-500 text-black rounded p-2 shadow-md hover:bg-green-600 transition-colors hover:cursor-pointer"
        >
          <PlusIcon className="w-6 h-6" />
        </button>
      )}
      {isOpen &&
        createPortal(
          <div className="fixed inset-0 bg-black/80 flex justify-center items-center w-screen h-screen z-100">
            <CreateIdeaForm
              onClose={() => setIsOpen(false)}
              defaultBucket={defaultBucket}
            />
          </div>,
          document.body,
        )}
    </div>
  );
}
