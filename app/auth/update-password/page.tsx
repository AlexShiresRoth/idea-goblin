import UpdatePasswordForm from "@/app/components/update-password-form";
import { getSession } from "@/lib/auth";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Set a new password",
  robots: { index: false, follow: false },
};

// Reached from a password reset email, which signs the user in on the way.
export default async function UpdatePassword() {
  const session = await getSession();

  if (!session) {
    redirect("/");
  }

  return (
    <div className="flex flex-col flex-1 items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex w-full max-w-3xl flex-col items-start gap-4 px-16 py-32">
        <h1 className="text-2xl">Set a new password</h1>
        <UpdatePasswordForm />
      </main>
    </div>
  );
}
