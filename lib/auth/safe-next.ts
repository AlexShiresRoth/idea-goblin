// Where to go after signing in: only a same-origin path, else the board.
// "//evil.com" is protocol-relative, and browsers read "/\evil.com" the same.
export function safeNext(next: unknown) {
  if (typeof next === "string" && /^\/(?![/\\])/.test(next)) {
    return next;
  }
  return "/main";
}
