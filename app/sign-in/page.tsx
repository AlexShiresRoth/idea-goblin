import { getSession } from "@/lib/auth";
import { safeNext } from "@/lib/auth/safe-next";
import clsx from "clsx";
import { Syne_Tactile } from "next/font/google";
import { redirect } from "next/navigation";
import Link from "next/link";
import { connection } from "next/server";
import AuthButton from "../components/auth-button";
import EmailAuthForm from "../components/email-auth-form";
import Logo from "../components/logo";

export const metadata = {
  title: "Sign in",
  alternates: { canonical: "/sign-in" },
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const syneTactile = Syne_Tactile({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-syne-tactile",
});

export default async function SignIn({ searchParams }: PageProps<"/sign-in">) {
  await connection();
  const { code, error, error_description, next: rawNext } = await searchParams;
  // Set by links that need a sign-in first, like saving a shared bucket.
  const next = safeNext(rawNext);

  if (typeof error === "string" || typeof error_description === "string") {
    const reason =
      typeof error_description === "string" ? error_description : error;
    redirect(
      `/auth/auth-code-error?reason=${encodeURIComponent(String(reason))}`,
    );
  }
  if (typeof code === "string" && code) {
    redirect(`/auth/callback?code=${encodeURIComponent(code)}`);
  }

  const session = await getSession();

  if (session) {
    redirect(next);
  }

  return (
    <>
      <main className="relative flex flex-1 w-full min-h-screen flex-col items-center justify-between sm:items-start bg-zinc-50 font-sans dark:bg-background decorative-bg overflow-clip">
        <div aria-hidden="true" className="pointer-events-none absolute h-full w-full flex items-center justify-center">
          <div className="relative flex items-center justify-center">
            <div className="absolute flex-1 w-200 h-200 border-2 border-accent/10 flex items-center justify-center rounded-full">
              <div className="border-2 border-accent/10 w-150 h-150 flex items-center justify-center">
                <div className="border-2 border-accent/10 w-100 h-100 rounded-full"></div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex w-full flex-1 md:flex-row flex-col md:gap-0 gap-8">
          <div className="flex-1 flex flex-col justify-center items-center relative px-4">
            <div className="flex flex-col md:h-full justify-between py-12 w-11/12 md:w-2/3">
              <div className="md:mb-0 mb-12">
                <Link href="/" aria-label="Idea Goblin home"><Logo /></Link>
              </div>
              <div className="flex flex-col gap-12">
                <span className="text-accent uppercase md:text-xl">
                  Stop collecting ideas.
                </span>
                <h1
                  className={clsx(
                    syneTactile.className,
                    "text-5xl md:text-6xl font-bold text-primary",
                  )}
                >
                  Start deciding which ideas are{` `}
                  <span className="text-accent">worth building</span>.
                </h1>
                <p className="dark:text-white/70 md:text-base text-sm">
                  Let the Idea Goblin help you focus or revise your ideas.
                  Whether it&apos;s something you want to build, or something
                  you just need out of your head.
                </p>
              </div>
              <div className="md:mt-0 mt-8">
                <p className="text-white/50 uppercase text-xs md:text-base">
                  Built for folks with infinite ideas
                </p>
              </div>
              <div className="md:hidden mt-12">
                <a
                  href="#sign-in"
                  className="px-4 py-2 bg-accent text-zinc-900"
                >
                  Get Started
                </a>
              </div>
            </div>
          </div>
          <div
            id="sign-in"
            className="flex flex-1 flex-col items-center bg-[#ededed] relative"
          >
            <div className="flex flex-col h-full items-center justify-center gap-8 w-11/12 px-4 py-8 md:py-0 md:w-2/3">
              <div className="flex flex-col gap-2 w-full max-w-md">
                <span className="text-lg text-zinc-600">Welcome Back</span>
                <h2 className="text-4xl md:text-5xl text-zinc-800">
                  Ready to think?
                </h2>
                <p className="text-zinc-400">
                  Sign in or create an account to shape your next idea.
                </p>
              </div>
              <EmailAuthForm next={next} />
              <p className="text-zinc-500">or sign in with</p>
              <div className="flex gap-2 md:flex-row flex-col mt-2 md:min-w-0 min-w-full max-w-md">
                <AuthButton
                  provider={{ value: "google", label: "Google" }}
                  next={next}
                />
                <AuthButton
                  provider={{ value: "github", label: "GitHub" }}
                  next={next}
                />
              </div>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
