"use client";
import { IdeaBucket, type Idea } from "@/lib/db/schema";
import clsx from "clsx";
import { XIcon } from "lucide-react";
import { useState } from "react";
import IdeaComponent from "./idea";

export default function Ideas({
  ideas,
  bucket,
}: {
  ideas: Idea[];
  bucket: IdeaBucket;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      aria-label="button"
      onClick={() => !expanded && setExpanded(!expanded)}
      data-bucket-id={bucket.id}
      className={clsx(
        expanded
          ? "fixed w-screen h-screen top-0 left-0 bg-black/80 z-50 flex flex-col items-center justify-center"
          : "flex bg-black flex-1 w-full h-fit flex-col gap-4 border border-white/20 rounded-lg items-start max-w-lg hover:bg-black/60 hover:border-white/50 transition-colors cursor-pointer",
      )}
    >
      {expanded && (
        <div className="flex w-3/4 md:w-1/3 items-center my-2 justify-end">
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-2"
          >
            <XIcon className="w-6 h-6" /> Close
          </button>
        </div>
      )}
      <div
        className={clsx(
          expanded
            ? "flex flex-col w-3/4 md:w-1/3  bg-black border border-white/20 rounded-lg"
            : "",
        )}
      >
        <div className="flex flex-col gap-2">
          <div className="flex flex-col p-4 border-b border-white/20">
            <div className="mb-2">
              <p className="text-xs text-green-500">{bucket.theme}</p>
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
      </div>
    </div>
  );
}
