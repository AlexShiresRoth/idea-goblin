import { bucketStyleVars } from "@/app/components/bucket-icon";
import { GameplanView } from "@/app/components/gameplan-view";
import { ThemePill } from "@/app/main/bucket-badges";
import { getSharedBucket } from "@/lib/api/buckets";
import { getSession } from "@/lib/auth";
import { isDone } from "@/lib/constants";
import type { BucketSnapshotIdea } from "@/lib/db/schema";
import { siteConfig } from "@/lib/site";
import clsx from "clsx";
import { CircleCheckIcon } from "lucide-react";
import type { Metadata } from "next";
import { Syne_Tactile as SyneTactile } from "next/font/google";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import SaveCopy from "./save-copy";

const syneTactile = SyneTactile({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-syne-tactile",
});

// Metadata and the page both need the bucket; this loads it once.
const loadShared = cache(getSharedBucket);

type Props = { params: Promise<{ token: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const shared = await loadShared((await params).token);
  return {
    title: shared ? shared.bucket.name : "Shared bucket",
    // Share links are private by obscurity: keep them out of search results
    // and out of the Referer sent to other sites.
    robots: { index: false, follow: false, nocache: true },
    referrer: "no-referrer",
  };
}

function SharedIdea({ idea }: { idea: BucketSnapshotIdea }) {
  const done = isDone(idea);
  return (
    <details className="group border-b border-white/20">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-4 text-sm hover:bg-white/5 transition-colors md:px-8">
        {done && (
          <CircleCheckIcon
            aria-label="Done"
            className="w-3 h-3 shrink-0 text-green-500/80"
          />
        )}
        <span className={clsx(done && "text-white/50 line-through")}>
          {idea.title}
        </span>
      </summary>
      <p className="px-4 pb-4 text-sm text-white/70 md:px-8">
        {idea.description}
      </p>
    </details>
  );
}

// A bucket someone shared by link: read-only, and open to anyone with the
// link, signed in or not.
export default async function SharedBucketPage({ params }: Props) {
  const { token } = await params;
  const [shared, session] = await Promise.all([
    loadShared(token),
    getSession(),
  ]);
  if (!shared) notFound();

  const { bucket, ideas, gameplan } = shared;
  const isOwner = session?.id === shared.ownerId;
  const openIdeas = ideas.filter((idea) => !isDone(idea));
  const doneIdeas = ideas.filter(isDone);

  return (
    <div
      style={bucketStyleVars(bucket.category)}
      className="flex min-h-dvh flex-col bg-black"
    >
      <nav className="flex items-center justify-between gap-4 border-b border-white/10 px-4 py-3 md:px-8">
        <Link
          href="/"
          className={clsx(
            syneTactile.className,
            "text-xl hover:text-primary transition-colors",
          )}
        >
          {siteConfig.name}
        </Link>
        <span className="text-xs text-white/50">Shared bucket</span>
      </nav>

      <header className="flex max-w-3xl flex-col gap-2 border-b border-(--bucket-primary)/40 px-4 py-6 md:px-8">
        <ThemePill bucket={bucket} />
        <h1 className="text-2xl">{bucket.name}</h1>
        <p className="text-sm text-white/50">{bucket.description}</p>
        <div className="mt-2">
          {isOwner ? (
            <p className="text-xs text-white/40">
              This is your bucket, as others see it.
            </p>
          ) : (
            <SaveCopy token={token} signedIn={session != null} />
          )}
        </div>
      </header>

      <div className="flex-1 md:grid md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <section aria-label="Ideas" className="flex flex-col">
          <h2 className="border-b border-white/20 px-4 py-2 text-white/60 md:px-8">
            Ideas {openIdeas.length}
            {doneIdeas.length > 0 && (
              <span className="ml-2 text-xs text-white/40">
                {doneIdeas.length} of {ideas.length} done
              </span>
            )}
          </h2>
          {ideas.length === 0 && (
            <p className="px-4 py-6 text-sm text-white/40 md:px-8">
              No ideas in here yet.
            </p>
          )}
          {openIdeas.map((idea) => (
            <SharedIdea key={idea.id} idea={idea} />
          ))}
          {doneIdeas.length > 0 && (
            <details>
              <summary className="cursor-pointer px-4 py-2 text-sm text-white/50 hover:text-white/80 transition-colors md:px-8">
                Done {doneIdeas.length}
              </summary>
              {doneIdeas.map((idea) => (
                <SharedIdea key={idea.id} idea={idea} />
              ))}
            </details>
          )}
        </section>
        <section
          aria-label="Gameplan"
          className="border-t border-white/20 md:border-t-0 md:border-l"
        >
          <h2 className="border-b border-white/20 px-4 py-2 text-white/60 md:px-8">
            Gameplan
          </h2>
          <div className="p-4">
            {gameplan ? (
              <GameplanView result={gameplan} ideas={ideas} readOnly />
            ) : (
              <p className="text-sm text-white/40">No gameplan yet.</p>
            )}
          </div>
        </section>
      </div>

      <footer className="border-t border-white/10 px-4 py-4 text-sm text-white/50 md:px-8">
        Made with {siteConfig.name}.{" "}
        <Link href="/" className="underline hover:text-white/80">
          Sort your own ideas
        </Link>
      </footer>
    </div>
  );
}
