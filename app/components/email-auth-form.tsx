"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState, useTransition } from "react";

import { createClient } from "@/lib/auth/supabase-client";

const supabase = createClient();

type Mode = "signin" | "signup" | "reset";

const SUBMIT_LABELS: Record<Mode, { idle: string; pending: string }> = {
  signin: { idle: "Sign in", pending: "Signing in..." },
  signup: { idle: "Create account", pending: "Creating account..." },
  reset: { idle: "Send reset link", pending: "Sending..." },
};

// Confirmation and reset emails link back through the same callback as OAuth.
function callbackUrl(next: string) {
  return `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
}

const inputClass =
  "rounded-md border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-700";
const linkClass = "underline hover:cursor-pointer";

// `next` is where to land once signed in, including after confirming email.
export default function EmailAuthForm({ next = "/main" }: { next?: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("signin");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function switchMode(next: Mode) {
    setMode(next);
    setError(null);
    setMessage(null);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email"));
    const password = String(form.get("password") ?? "");
    const name = String(form.get("name") ?? "").trim();
    setError(null);
    setMessage(null);

    startTransition(async () => {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) return setError(error.message);
        router.push(next);
        return;
      }

      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { name }, emailRedirectTo: callbackUrl(next) },
        });
        if (error) return setError(error.message);
        // No session means the email has to be confirmed first.
        if (data.session) {
          router.push(next);
          return;
        }
        setMessage("Check your email for a link to confirm your account.");
        return;
      }

      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: callbackUrl("/auth/update-password"),
      });
      if (error) return setError(error.message);
      setMessage(
        "If that email has an account, we've sent a link to reset your password.",
      );
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex w-full max-w-sm flex-col gap-3"
    >
      {mode === "signup" && (
        <label className="flex flex-col gap-1 text-sm">
          Name
          <input
            name="name"
            autoComplete="name"
            required
            className={inputClass}
          />
        </label>
      )}
      <label className="flex flex-col gap-1 text-sm">
        Email
        <input
          name="email"
          type="email"
          autoComplete="email"
          required
          className={inputClass}
        />
      </label>
      {mode !== "reset" && (
        <label className="flex flex-col gap-1 text-sm">
          Password
          <input
            name="password"
            type="password"
            autoComplete={
              mode === "signup" ? "new-password" : "current-password"
            }
            minLength={mode === "signup" ? 8 : undefined}
            required
            className={inputClass}
          />
        </label>
      )}

      {error && (
        <p role="alert" className="text-sm text-red-500">
          {error}
        </p>
      )}
      {message && (
        <p
          aria-live="polite"
          className="text-sm text-zinc-600 dark:text-zinc-400"
        >
          {message}
        </p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="rounded-md bg-zinc-900 px-4 py-2 text-white hover:cursor-pointer hover:bg-zinc-700 disabled:opacity-60 dark:bg-zinc-100 dark:text-black dark:hover:bg-zinc-300"
      >
        {isPending ? SUBMIT_LABELS[mode].pending : SUBMIT_LABELS[mode].idle}
      </button>

      <div className="flex flex-wrap justify-between gap-2 text-sm text-zinc-600 dark:text-zinc-400">
        {mode === "signin" ? (
          <>
            <button
              type="button"
              className={linkClass}
              onClick={() => switchMode("signup")}
            >
              Create an account
            </button>
            <button
              type="button"
              className={linkClass}
              onClick={() => switchMode("reset")}
            >
              Forgot password?
            </button>
          </>
        ) : (
          <button
            type="button"
            className={linkClass}
            onClick={() => switchMode("signin")}
          >
            {mode === "signup"
              ? "Already have an account? Sign in"
              : "Back to sign in"}
          </button>
        )}
      </div>
    </form>
  );
}
