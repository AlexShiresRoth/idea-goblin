// Newline-delimited JSON streaming, for routes that report progress as they
// run (vault analysis, idea import).
export const NDJSON_HEADERS = {
  "Content-Type": "application/x-ndjson; charset=utf-8",
  "Cache-Control": "no-cache, no-transform",
  "X-Accel-Buffering": "no",
  "X-Content-Type-Options": "nosniff",
};

export function encodeEvent(event: object) {
  return new TextEncoder().encode(`${JSON.stringify(event)}\n`);
}

// Calls `onEvent` for each line of a streamed NDJSON response body.
export async function readNdjson<T>(
  response: Response,
  onEvent: (event: T) => void,
) {
  if (!response.body) throw new Error("No body in response");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (line) onEvent(JSON.parse(line) as T);
    }
  }
  if (buffer.trim()) onEvent(JSON.parse(buffer) as T);
}
