import { getSession } from "@/lib/auth";
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

// TODO handle these error pages
export default async function Home({ searchParams }: PageProps<"/">) {
  await connection();

  const { code, error, error_description } = await searchParams;
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
    redirect("/main");
  }

  return (
    <div className="flex flex-col flex-1 items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex flex-1 w-full min-h-screen flex-col items-center justify-between py-4 md:py-32 px-4 md:px-16 bg-white dark:bg-black sm:items-start">
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
        <div className="flex w-full h-full border-2 border-white/20 flex-1 md:flex-row flex-col md:gap-0 gap-8">
          <div className="flex flex-col justify-center gap-4 md:border-r-2 border-white/20 w-full">
            <div className="flex-4 flex items-center justify-center p-4 md:p-0">
              <h1
                className={clsx(
                  syneTactile.className,
                  "md:text-9xl text-6xl font-bold text-primary",
                )}
              >
                Idea Goblin.
              </h1>
            </div>
            <div className="flex-1 flex items-center justify-center bg-white text-black text-xl md:p-0 p-4">
              <p>AI Powered Idea Management.</p>
            </div>
          </div>
          <div className="flex flex-col w-full gap-4 md:mt-0 mt-8">
            <div className="flex-2 flex flex-col items-center justify-center gap-4">
              <div>
                <h2 className="text-2xl font-bold">Welcome to Idea Goblin.</h2>
              </div>
              <EmailAuthForm />
              <p>or sign in with</p>
              <div className="flex gap-2 md:flex-row flex-col mt-2">
                <AuthButton provider={{ value: "google", label: "Google" }} />
                <AuthButton provider={{ value: "github", label: "GitHub" }} />
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
