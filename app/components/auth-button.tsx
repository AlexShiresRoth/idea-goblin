"use client";

import { useTransition } from "react";

import { createClient } from "@/lib/auth/supabase-client";

const supabase = createClient();

export async function signIn(provider: "github" | "google") {
  const { error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: `${window.location.origin}/auth/callback?next=/main`,
    },
  });
  if (error) {
    console.error("Error signing in", error);
    return null;
  }
}

export default function AuthButton({
  provider,
}: {
  provider: { value: "github" | "google"; label: string };
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <button
      onClick={() =>
        startTransition(async () => {
          await signIn(provider.value);
        })
      }
      className="hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:cursor-pointer px-4 py-2 rounded-md"
      disabled={isPending}
    >
      {isPending ? "Signing in..." : `Sign in with ${provider.label}`}
    </button>
  );
}
