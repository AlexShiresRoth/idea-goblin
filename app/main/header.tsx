import clsx from "clsx";
import CreateIdeaModal from "../components/create-idea-modal";
import ImportIdeasModal from "../components/import-ideas-modal";
import Sidebar from "./sidebar";

import { Syne_Tactile as SyneTactile } from "next/font/google";
import Link from "next/link";
import AnalyzeVault from "../components/analyze-vault";
import BackButton from "./back-button";

const syneTactile = SyneTactile({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-syne-tactile",
});

export default function Header({ hasBuckets }: { hasBuckets: boolean }) {
  return (
    <header className="flex w-full items-stretch border-b border-white/10">
      <div className="md:hidden flex flex-1 items-center justify-between p-3 px-4">
        <Link
          href="/main"
          data-testid="home-link"
          className={clsx(
            syneTactile.className,
            "text-xl hover:text-primary transition-colors",
          )}
        >
          Idea Goblin
        </Link>
        <BackButton />
      </div>
      <Sidebar>
        <div className="flex w-full items-center p-4 border-r border-white/10">
          <Link
            href="/main"
            data-testid="home-link"
            className={clsx(
              syneTactile.className,
              "px-2 text-xl hover:text-primary transition-colors",
            )}
          >
            Idea Goblin
          </Link>
        </div>
      </Sidebar>
      <div className="hidden md:flex flex-1 min-w-0 items-center gap-2 p-3 px-4">
        <CreateIdeaModal type="inline" />
        <ImportIdeasModal type="inline" />
        <AnalyzeVault hasBuckets={hasBuckets} />
        <div className="ml-auto">
          <BackButton />
        </div>
      </div>
    </header>
  );
}
