"use client";

import clsx from "clsx";
import { PlusIcon, XIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

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
  const router = useRouter();
  const [description, setDescription] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    if (description.length === 0) {
      setError("Description is required");
      return;
    }
    try {
      e.preventDefault();
      setIsLoading(true);
      const response = await fetch("/api/ideas/create", {
        method: "POST",
        body: JSON.stringify({ description }),
      });
      if (!response.ok) {
        throw new Error("Failed to create idea");
      }
      onClose();
    } catch (error) {
      console.error(error);
      setError("Failed to create idea");
    } finally {
      onClose();
      setIsLoading(false);
      router.refresh();
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
}: {
  type: "floating" | "inline";
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div>
      {type === "inline" && (
        <button
          onClick={() => setIsOpen(true)}
          className="md:flex hidden items-center text-sm gap-2 bg-white/10 hover:bg-white/20 transition-colors rounded-md p-2 hover:cursor-pointer"
        >
          <PlusIcon className="w-4 h-4" />
          New Idea
        </button>
      )}
      {!isOpen && type === "floating" && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-12 md:bottom-15 right-5 md:right-15 bg-green-500 text-black rounded p-2 shadow-md hover:bg-green-600 transition-colors hover:cursor-pointer"
        >
          <PlusIcon className="w-6 h-6" />
        </button>
      )}
      {isOpen && (
        <div className="fixed inset-0 bg-black/80 flex justify-center items-center w-screen h-screen z-50">
          <CreateIdeaForm onClose={() => setIsOpen(false)} />
        </div>
      )}
    </div>
  );
}
