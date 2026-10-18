"use client";

import type { BucketChoice, BucketOption } from "@/lib/types";
import clsx from "clsx";
import { PlusIcon, XIcon } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useContext, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ToastContext } from "../context/toast.provider";
import ActionButton from "./action-button";

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

function Textarea({
  id,
  value,
  onChange,
  rows,
}: {
  id: string;
  value: string;
  rows: number;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
}) {
  return (
    <textarea
      id={id}
      value={value}
      name={id}
      onChange={onChange}
      rows={rows}
      required
      className="mt-1 block w-full rounded-md border focus:outline-none border-white/10 bg-white/10 px-3 py-1 text-white placeholder:text-white/50 focus:border-white/50 focus:ring-white/50"
    />
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
}: {
  children: React.ReactNode;
  type: "button" | "submit";
  isLoading?: boolean;
}) {
  return (
    <button
      type={type}
      disabled={isLoading}
      className="bg-green-500 text-sm text-black font-semibold rounded p-2 shadow-md hover:bg-green-600 transition-colors hover:cursor-pointer"
    >
      {children}
    </button>
  );
}

function Counter({
  valueLength,
  maxLength,
  className,
}: {
  valueLength: number;
  maxLength: number;
  className?: string;
}) {
  const color = valueLength >= maxLength ? "text-orange-500" : "text-white/50";
  return (
    <div className={clsx(color, "text-sm", className)}>
      {valueLength} / {maxLength}
    </div>
  );
}

function CreateIdeaForm({ onClose }: { onClose: () => void }) {
  const { setToasts } = useContext(ToastContext);
  const router = useRouter();
  const pathname = usePathname();
  const [description, setDescription] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [bucket, setBucket] = useState<BucketChoice>("auto");
  const [bucketName, setBucketName] = useState("");
  const [buckets, setBuckets] = useState<BucketOption[]>([]);
  const [bucketsLoading, setBucketsLoading] = useState(true);

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

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    if (description.length === 0) {
      setToasts([
        {
          id: "description-required",
          message: "Description is required",
          type: "error",
        },
      ]);
      return;
    }
    try {
      e.preventDefault();
      setIsLoading(true);
      const response = await fetch("/api/ideas/create", {
        method: "POST",
        body: JSON.stringify({
          description,
          bucket,
          bucketName: bucket === "new" ? bucketName.trim() : undefined,
        }),
      });
      if (!response.ok) {
        throw new Error("Failed to create idea");
      }
      setToasts([
        {
          id: "idea-created",
          message: "Idea added to the hoard",
          type: "success",
        },
      ]);
      if (pathname.split("/").pop() !== "main") {
        router.push("/main");
      } else {
        router.refresh();
      }
    } catch (error) {
      console.error(error);
      setToasts([
        {
          id: "failed-to-create-idea",
          message: "Failed to create idea",
          type: "error",
        },
      ]);
    } finally {
      onClose();
      setIsLoading(false);
    }
  }
  return (
    <div className="p-4 rounded-lg border border-white/20 w-11/12 md:w-1/3 bg-black">
      <div className="flex justify-between items-center border-b border-white/20 pb-4">
        <h2 className="text-2xl font-bold">New Idea</h2>
        <button onClick={onClose} className="hover:cursor-pointer">
          <XIcon className="w-4 h-4" />
        </button>
      </div>
      <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
        <div className="flex flex-col my-2 relative">
          <Label htmlFor="description">What&apos;s your idea?</Label>
          <Textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={5}
          />
          <Counter
            valueLength={description.length}
            maxLength={500}
            className="absolute bottom-2 right-2"
          />
        </div>

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
              placeholder="Bucket name (defaults to the idea's title)"
              aria-label="New bucket name"
              className={fieldClassName}
            />
          )}
        </div>

        <div className="flex justify-end">
          <Button type="submit" isLoading={isLoading}>
            {isLoading ? "Creating..." : "Create Idea"}
          </Button>
        </div>
      </form>
    </div>
  );
}

export default function CreateIdeaModal({
  type,
  onTrigger,
}: {
  type: "floating" | "inline" | "menu";
  onTrigger?: () => void;
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
            <CreateIdeaForm onClose={() => setIsOpen(false)} />
          </div>,
          document.body,
        )}
    </div>
  );
}
