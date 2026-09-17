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

function Input({
  type,
  id,
  value,
  onChange,
}: {
  type: string;
  id: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <input
      type={type}
      id={id}
      value={value}
      name={id}
      onChange={onChange}
      className="mt-1 block w-full rounded-md border focus:outline-none border-white/20 bg-white/5 px-3 py-1 text-white placeholder:text-white/50 focus:border-white/50 focus:ring-white/50"
    />
  );
}

function Select({
  id,
  value,
  onChange,
  options,
}: {
  id: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  options: { label: string; value: string }[];
}) {
  return (
    <select
      id={id}
      value={value}
      name={id}
      onChange={onChange}
      className="mt-1 block w-full rounded-md border-white/20 bg-white/5 px-3 py-2 text-white placeholder:text-white/50 focus:border-white/50 focus:ring-white/50"
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
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
      className="mt-1 block w-full rounded-md border focus:outline-none border-white/20 bg-white/5 px-3 py-1 text-white placeholder:text-white/50 focus:border-white/50 focus:ring-white/50"
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
      className="bg-green-500 text-black rounded p-2 shadow-md hover:bg-green-600 transition-colors hover:cursor-pointer"
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

const IDEA_TYPES = ["idea", "project", "product", "service", "other"] as const;

function CreateIdeaForm({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [description, setDescription] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
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
    <div className="p-4 rounded-lg border border-white/20 w-3/4 md:w-1/3">
      <div className="flex justify-between items-center border-b border-white/20 pb-4">
        <h2 className="text-2xl font-bold">New Idea</h2>
        <button onClick={onClose}>
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

        <div>
          <Button type="submit" isLoading={isLoading}>
            {isLoading ? "Creating..." : "Create Idea"}
          </Button>
        </div>
      </form>
    </div>
  );
}

export default function CreateIdeaModal() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div>
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-10 right-10 bg-green-500 text-black rounded p-2 shadow-md hover:bg-green-600 transition-colors hover:cursor-pointer"
        >
          <PlusIcon className="w-5 h-5" />
        </button>
      )}
      {isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center w-screen h-screen z-50">
          <CreateIdeaForm onClose={() => setIsOpen(false)} />
        </div>
      )}
    </div>
  );
}
