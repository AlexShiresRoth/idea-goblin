import { getSession } from "@/lib/auth";
import { safeNext } from "@/lib/auth/safe-next";
import { siteConfig } from "@/lib/site";
import clsx from "clsx";
import { Syne_Tactile } from "next/font/google";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import AuthButton from "./components/auth-button";
import EmailAuthForm from "./components/email-auth-form";

export const dynamic = "force-dynamic";

const syneTactile = Syne_Tactile({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-syne-tactile",
});

function Logo({ dark }: { dark?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <span
        className={clsx(
          syneTactile.className,
          "w-8 h-8 font-bold rounded-none bg-accent text-background flex items-center justify-center border-4 border-accent/90",
        )}
      >
        IG
      </span>
      <p
        className={clsx("uppercase", dark ? "text-zinc-700" : "text-zinc-300")}
      >
        Idea Goblin
      </p>
    </div>
  );
}

// TODO handle these error pages
export default async function Home({ searchParams }: PageProps<"/">) {
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
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "WebApplication",
            name: siteConfig.name,
            description: siteConfig.description,
            applicationCategory: "ProductivityApplication",
            offers: {
              "@type": "Offer",
              price: "0",
              priceCurrency: "USD",
            },
          }),
        }}
      />
      <main className="relative flex flex-1 w-full min-h-screen flex-col items-center justify-between sm:items-start bg-zinc-50 font-sans dark:bg-background decorative-bg overflow-clip">
        <div className="absolute h-full w-full flex items-center justify-center">
          <div className="relative flex items-center justify-center">
            <div className="absolute flex-1 w-200 h-200 border-2 border-accent/10 flex items-center justify-center rounded-full">
              <div className="border-2 border-accent/10 w-150 h-150 flex items-center justify-center">
                <div className="border-2 border-accent/10 w-100 h-100 rounded-full"></div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex w-full flex-1 md:flex-row flex-col md:gap-0 gap-8">
          <div className="flex-1 md:flex flex-col justify-center items-center relative px-4 hidden">
            <div className="flex flex-col md:h-full justify-between py-12 w-11/12 md:w-2/3">
              <Logo />
              <div className="flex flex-col gap-12">
                <span className="text-accent uppercase text-xl">
                  AI Powered Idea Management
                </span>
                <h1
                  className={clsx(
                    syneTactile.className,
                    "text-2xl md:text-6xl font-bold text-primary",
                  )}
                >
                  Release the ideas from your{" "}
                  <span className="text-accent">mind cage</span>.
                </h1>
                <p className="dark:text-white/70">
                  Let the Idea Goblin help you focus or revise your ideas.
                  Whether it's something you want to build, or something you
                  just need out of your head.
                </p>
              </div>
              <div>
                <p className="text-white/50 uppercase">
                  Built for folks with many ideas
                </p>
              </div>
            </div>
          </div>
          <div className="flex flex-1 flex-col items-center bg-foreground relative">
            <div className="flex flex-col h-full items-center justify-center gap-8 w-11/12 px-4 py-8 md:py-0 md:w-2/3">
              <div className="md:hidden w-full mb-8">
                <Logo dark />
              </div>
              <div className="flex flex-col gap-2 w-full max-w-md">
                <span className="text-lg text-zinc-600">Welcome Back</span>
                <h2 className="text-4xl md:text-5xl text-zinc-800">
                  Ready to think?
                </h2>
                <p className="text-zinc-400">
                  Sign in to shaping your next great idea.
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
