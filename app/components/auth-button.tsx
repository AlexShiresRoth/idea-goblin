"use client";

import { useTransition } from "react";

import { createClient } from "@/lib/auth/supabase-client";

const supabase = createClient();

export async function signIn(provider: "github" | "google") {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: `${window.location.origin}/auth/callback?next=/main`,
    },
  });
  if (error) {
    console.error("Error signing in", error);
    return null;
  }
  console.log("data", data);
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
          console.log(provider.value);
          await signIn(provider.value);
        })
      }
    >
      {isPending ? "Signing in..." : `Sign in with ${provider.label}`}
    </button>
  );
}
