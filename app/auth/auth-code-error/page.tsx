import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Sign in failed",
  robots: { index: false, follow: false },
};

export default async function AuthCodeError({
  searchParams,
}: PageProps<"/auth/auth-code-error">) {
  const { reason } = await searchParams;

  return (
    <div className="flex flex-col flex-1 items-center justify-center bg-background font-sans">
      <main className="flex w-full max-w-3xl flex-col items-start gap-4 px-16 py-32">
        <h1 className="text-2xl">We couldn&apos;t finish signing you in.</h1>
        <p className="text-primary/60">
          The sign in link was already used or has expired. Please try again.
        </p>
        {typeof reason === "string" && reason ? (
          <p
            data-testid="auth-error-reason"
            className="font-mono text-sm text-zinc-500"
          >
            {reason}
          </p>
        ) : null}
        <Link
          href="/"
          data-testid="auth-error-back"
          className="rounded-none border border-accent/40 px-4 py-2 text-accent hover:bg-accent/10"
        >
          Back to sign in
        </Link>
      </main>
    </div>
  );
}
