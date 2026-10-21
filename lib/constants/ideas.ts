// An idea is open or done; nothing in between, so buckets stay idea lists
// rather than task boards. Open ideas keep the original "incubating" value.
export const IDEA_STATUS = {
  open: "incubating",
  done: "done",
} as const;

export function isDone(idea: { status: string }) {
  return idea.status === IDEA_STATUS.done;
}
