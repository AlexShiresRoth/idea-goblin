import { isDone } from "@/lib/constants";
import type { IdeaBucket, IdeaView } from "@/lib/db/schema";
import { CircleParkingIcon, CrosshairIcon } from "lucide-react";
import { BucketIcon } from "../components/bucket-icon";

export function timeAgo(date: Date) {
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

export function doneCount(ideas: IdeaView[]) {
  return `${ideas.filter(isDone).length} of ${ideas.length} done`;
}

// "Working on" or "Parked", from whether the bucket has an active start.
export function FocusBadge({ active }: { active: boolean }) {
  return active ? (
    <span className="flex items-center gap-1 rounded-full border border-green-500/40 bg-green-500/10 px-2 py-1 text-xs text-green-300">
      <CrosshairIcon className="w-3 h-3" />
      Working on
    </span>
  ) : (
    <span className="flex items-center gap-1 rounded-full border border-white/20 px-2 py-1 text-xs text-white/60">
      <CircleParkingIcon className="w-3 h-3" />
      Parked
    </span>
  );
}

export function ThemePill({
  bucket,
}: {
  bucket: Pick<IdeaBucket, "category" | "theme">;
}) {
  return (
    <div className="flex w-fit items-center gap-1 rounded-full border border-(--bucket-primary)/50 bg-(--bucket-accent)/10 px-2 py-1">
      <BucketIcon category={bucket.category} className="w-3 h-3" />
      <p className="text-xs text-(--bucket-tertiary)">{bucket.theme}</p>
    </div>
  );
}
