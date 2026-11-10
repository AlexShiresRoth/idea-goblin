import { RestoreBucketButton } from "@/app/components/restore-bucket-button";
import { getDeletedIdeaBuckets } from "@/lib/api/buckets";
import { getSession } from "@/lib/auth";
import Link from "next/link";

export default async function TrashPage() {
  const session = await getSession();
  if (!session) return null;

  const buckets = await getDeletedIdeaBuckets(session.id);

  return (
    <div className="flex flex-col w-full h-full min-h-0">
      <header className="flex flex-col gap-2 p-4 border-b border-white/20 shrink-0">
        <h1 className="text-xl font-bold text-accent">Trash</h1>
        <p className="text-sm text-white/60">
          Deleted buckets are kept here with their ideas, versions, and analyses.
          Restored buckets return to the Board parked, with sharing off.
        </p>
      </header>
      <div className="flex-1 min-h-0 overflow-y-auto">
        {buckets.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 p-4 h-full">
            <p className="text-sm text-white/60">No deleted buckets. Trash is empty.</p>
            <Link href="/main" className="action-button text-accent">
              Back to Board
            </Link>
          </div>
        ) : (
          <ul aria-label="Deleted buckets" className="flex flex-col">
            {buckets.map((bucket) => (
              <li
                key={bucket.id}
                className="flex flex-col gap-3 p-4 border-b border-white/10 sm:flex-row sm:items-start sm:justify-between"
              >
                <div className="flex flex-col gap-1 min-w-0">
                  <h2 className="font-semibold break-words">{bucket.name}</h2>
                  {bucket.description && (
                    <p className="text-sm text-white/60 break-words">{bucket.description}</p>
                  )}
                  {bucket.deletedAt && (
                    <p className="text-sm text-white/50">
                      Deleted{" "}
                      <time dateTime={new Date(bucket.deletedAt).toISOString()}>
                        {new Date(bucket.deletedAt).toLocaleDateString("en-US", {
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                          timeZone: "UTC",
                        })}
                      </time>
                    </p>
                  )}
                </div>
                <RestoreBucketButton bucketId={bucket.id} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
