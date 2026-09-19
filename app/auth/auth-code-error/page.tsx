import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Sign in failed",
  robots: { index: false, follow: false },
};

export default async function AuthCodeError({ searchParams }: PageProps<"/auth/auth-code-error">) {
  const { reason } = await searchParams;

  return (
    <div className="flex flex-col flex-1 items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex w-full max-w-3xl flex-col items-start gap-4 px-16 py-32">
        <h1 className="text-2xl">We couldn&apos;t finish signing you in.</h1>
        <p className="text-zinc-600 dark:text-zinc-400">
          The sign in link was already used or has expired. Please try again.
        </p>
        {typeof reason === "string" && reason ? (
          <p className="font-mono text-sm text-zinc-500">{reason}</p>
        ) : null}
        <Link href="/" className="rounded-md px-4 py-2 underline hover:bg-zinc-100 dark:hover:bg-zinc-800">
          Back to sign in
        </Link>
      </main>
    </div>
  );
}
