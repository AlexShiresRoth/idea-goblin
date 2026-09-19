import { getSession } from "@/lib/auth";
import { siteConfig } from "@/lib/site";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import AuthButton from "./components/auth-button";

export const dynamic = "force-dynamic";

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
      <main className="flex flex-1 w-full max-w-3xl flex-col items-center justify-between py-32 px-16 bg-white dark:bg-black sm:items-start">
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
        <h1>Welcome to Idea Goblin.</h1>
        <AuthButton provider={{ value: "github", label: "Github" }} />
      </main>
    </div>
  );
}
