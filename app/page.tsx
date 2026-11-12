import { getSession } from "@/lib/auth";
import { safeNext } from "@/lib/auth/safe-next";
import { siteConfig } from "@/lib/site";
import clsx from "clsx";
import { Syne_Tactile } from "next/font/google";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import Logo from "./components/logo";
import MarketingPreview from "./components/marketing-preview";
import { ArrowDown, ArrowUpRight, Check, FolderOpen, Lightbulb, Sparkles } from "lucide-react";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

const syneTactile = Syne_Tactile({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-syne-tactile",
});

export default async function Home({ searchParams }: PageProps<"/">) {
  await connection();
  const { code, error, error_description, next: rawNext } = await searchParams;
  // Set by links that need a sign-in first, like saving a shared bucket.
  const next = safeNext(rawNext);
  const signInHref = next === "/main" ? "/sign-in" : `/sign-in?next=${encodeURIComponent(next)}`;

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
      <main className={clsx(styles.page, "decorative-bg")}>
        <header className={styles.header}>
          <a href="#" aria-label="Idea Goblin home"><Logo /></a>
          <nav aria-label="Main navigation">
            <a href="#how-it-works">How it works</a>
            <a href="#why-goblin">Why Goblin?</a>
            <a href={signInHref} className={styles.navCta}>Sign in <ArrowUpRight size={15} /></a>
          </nav>
        </header>
        <section className={styles.hero} aria-labelledby="hero-heading">
          <div>
            <p className={styles.eyebrow}><span /> A home for your next big maybe</p>
            <h1 id="hero-heading" className={clsx(syneTactile.className, styles.title)}>
              Too many ideas.<br />Meet your<br /><span>filter.</span>
            </h1>
            <p className={styles.intro}>Get the ideas out of your head. Give them a little structure. Figure out which ones are worth building.</p>
            <div className={styles.heroActions}>
              <a href={signInHref} className={styles.cta}>Find your next idea <ArrowUpRight size={20} /></a>
              <a href="#how-it-works" className={styles.textLink}>Take a look around <ArrowDown size={16} /></a>
            </div>
            <p className={styles.small}>For side-project starters. Serial brainstormers. You.</p>
          </div>
          <MarketingPreview />
        </section>

        <div className={styles.manifesto}>Keep the spark. <span>Lose the spiral.</span></div>

        <section id="how-it-works" className={styles.section} aria-labelledby="how-heading">
          <div className={styles.sectionHeading}><p className={styles.eyebrow}>01 / FROM SCATTERED TO STARTED</p><h2 id="how-heading">Your brain has enough tabs open.</h2><p>Give every thought a place to land, then give the promising ones a way forward.</p></div>
          <div className={styles.steps}>
            {[
              { number: "01", icon: Lightbulb, title: "Catch the spark.", text: "The half-formed thought. The shower revelation. The project you keep coming back to. Capture it before it disappears." },
              { number: "02", icon: FolderOpen, title: "Find its people.", text: "Group related ideas into buckets. Connect the dots, spot a theme, and keep the context together." },
              { number: "03", icon: Sparkles, title: "Give it a reality check.", text: "Use AI analysis and refinement to explore an idea, challenge assumptions, and shape a clearer next step." },
            ].map(({ number, icon: Icon, title, text }) => (
              <article key={number} className={styles.step}><div className={styles.stepTop}><Icon size={25} /><span>{number}</span></div><h3>{title}</h3><p>{text}</p></article>
            ))}
          </div>
        </section>

        <section id="why-goblin" className={styles.focusSection} aria-labelledby="focus-heading">
          <div><p className={styles.eyebrow}>02 / A LITTLE HEALTHY RESTRAINT</p><h2 id="focus-heading" className={syneTactile.className}>You can do anything.<br /><span>Just not everything.</span></h2></div>
          <div className={styles.focusCopy}><p>Some ideas deserve your attention now. Others need a safe place to wait. Idea Goblin helps you make room for both.</p><ul><li><Check size={18} /> Choose which buckets get your focus.</li><li><Check size={18} /> Park the rest without losing the thought.</li><li><Check size={18} /> Revisit, refine, and change your mind.</li></ul><a href={signInHref} className={styles.textLink}>Make room for what matters <ArrowUpRight size={18} /></a></div>
        </section>

        <section className={styles.signIn} aria-labelledby="final-heading">
          <div className={styles.signInCopy}><p className={styles.eyebrow}>03 / LET IT OUT OF YOUR HEAD</p><h2 id="final-heading" className={syneTactile.className}>Your next good idea<br />needs somewhere<br /><span>to start.</span></h2><p>A messy first thought is more than enough.<br />Bring it. The Goblin can work with that.</p><Logo /></div>
          <div>
            <a href={signInHref} className={styles.cta}>Find your next idea <ArrowUpRight size={20} /></a>
            <p className={styles.small}>Sign in or create an account to get started.</p>
          </div>
        </section>
        <footer className={styles.footer}><span>© {new Date().getFullYear()} Idea Goblin</span><span>Built for folks with infinite ideas.</span><a href="#">Back to top ↑</a></footer>
      </main>
    </>
  );
}
