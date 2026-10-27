import { isDone } from "@/lib/constants";
import { IdeaBucket, type IdeaView } from "@/lib/db/schema";
import clsx from "clsx";
import Link from "next/link";
import { bucketStyleVars } from "../components/bucket-icon";
import { doneCount, FocusBadge, ThemePill, timeAgo } from "./bucket-badges";

// A bucket on the board, linking to its page.
export default function IdeasBucket({
  ideas,
  bucket,
}: {
  ideas: IdeaView[];
  bucket: IdeaBucket;
}) {
  return (
    <Link
      href={`/main/buckets/${bucket.id}`}
      data-bucket-id={bucket.id}
      data-testid="bucket-card"
      // Category colors as CSS variables; everything inside inherits them.
      style={bucketStyleVars(bucket.category)}
      className={clsx(
        "flex bg-black flex-col gap-2 p-4 border border-white/20 rounded-lg items-start break-inside-avoid mb-2 hover:bg-black/60 hover:border-(--bucket-primary)/50 transition-[colors,opacity]",
        // Parked buckets step back, but come forward on hover to stay usable.
        bucket.activeSince == null && "opacity-50 hover:opacity-100",
      )}
    >
      <div className="flex w-full items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <ThemePill bucket={bucket} />
          <FocusBadge active={bucket.activeSince != null} />
        </div>
        <p className="text-xs text-white/50">{timeAgo(bucket.updatedAt)}</p>
      </div>
      <h2 className="flex items-center gap-2 text-xl">{bucket.name}</h2>
      <p className="text-sm text-white/50">
        {bucket.description.slice(0, 200)}
        {bucket.description.length > 200 && "..."}
      </p>
      {ideas.some(isDone) && (
        <p className="text-xs text-white/40" data-testid="bucket-done-count">
          {doneCount(ideas)}
        </p>
      )}
    </Link>
  );
}
