import { FocusProvider } from "@/app/components/focus-provider";
import { getFocusLimit, getIdeaBuckets, getIdeasForBuckets } from "@/lib/api/";
import { getSession } from "@/lib/auth";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import BucketDetail from "../../bucket-detail";

export const metadata: Metadata = { title: "Bucket" };

export default async function BucketPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session) notFound();

  const { id } = await params;
  // All of the user's buckets, which the focus controls need anyway; a bucket
  // that isn't among them is someone else's or doesn't exist.
  const [buckets, focusLimit] = await Promise.all([
    getIdeaBuckets(session.id),
    getFocusLimit(session.id),
  ]);
  const bucket = buckets.find((item) => String(item.id) === id);
  if (!bucket) notFound();

  const ideasByBucket = await getIdeasForBuckets([bucket.id]);

  return (
    <FocusProvider
      buckets={buckets.map((item) => ({
        id: item.id,
        name: item.name,
        active: item.activeSince != null,
      }))}
      limit={focusLimit}
    >
      <BucketDetail bucket={bucket} ideas={ideasByBucket.get(bucket.id) ?? []} />
    </FocusProvider>
  );
}
