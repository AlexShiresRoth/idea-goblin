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
    <header className="flex w-full items-center border-b border-white/10">
      <div className="md:hidden flex items-center p-3 px-4">
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
      </div>
      <Sidebar>
        <div className="flex w-full items-center justify-center p-4 border-r border-white/10 flex-1">
          <div className="flex w-11/12">
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
          </div>
        </div>
      </Sidebar>
      <div className="hidden md:flex flex-8 min-w-0">
        <div className="flex items-center gap-2 p-3 px-4 flex-1">
          <CreateIdeaModal type="inline" />
          <ImportIdeasModal type="inline" />
          <AnalyzeVault hasBuckets={hasBuckets} />
        </div>
      </div>
      <div className="ml-auto flex items-center p-3 px-4">
        <BackButton />
      </div>
    </header>
  );
}
