"use client";
import { type Idea } from "@/lib/db/schema";
import { MinusIcon, PlusIcon } from "lucide-react";
import { useState } from "react";

export default function Idea({ idea }: { idea: Idea }) {
  const [expanded, setExpanded] = useState(false);

  console.log(idea);
  return (
    <div
      className="flex flex-col border-b border-white/20 hover:cursor-pointer hover:bg-white/5 transition-colors"
      onClick={() => setExpanded(!expanded)}
    >
      <div className="flex items-center gap-4">
        <button
          onClick={() => setExpanded(!expanded)}
          className="hover:cursor-pointer hover:bg-white/5 transition-colors p-2 border-r border-white/20 h-full"
        >
          {!expanded ? (
            <PlusIcon className="w-4 h-4" />
          ) : (
            <MinusIcon className="w-4 h-4" />
          )}
        </button>
        <div className="flex flex-col p-4">
          <p className="text-sm">{idea.title}</p>
          {expanded && (
            <div className="flex flex-col">
              <p className="text-sm text-white/70">{idea.description}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
