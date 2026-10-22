// How many new buckets can start as being worked on. Until the user parks
// something, new buckets fill their focus up to the limit; once anything is
// parked, new buckets start parked so they don't upend a chosen focus.
export function activeSlotsForNewBuckets(
  buckets: { activeSince: Date | null }[],
  limit: number,
) {
  if (buckets.some((bucket) => bucket.activeSince == null)) return 0;
  return Math.max(0, limit - buckets.length);
}
