import clsx from "clsx";
import CreateIdeaModal from "../components/create-idea-modal";
import Container from "./container";
import Sidebar from "./sidebar";
import SignoutButton from "./signout-button";

import { Syne_Tactile as SyneTactile } from "next/font/google";
import AnalyzeVault from "../components/analyze-vault";

const syneTactile = SyneTactile({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-syne-tactile",
});

export default function Header() {
  return (
    <header className="flex w-full items-center border-b border-white/10">
      <Sidebar>
        <div className="flex items-center justify-center p-4 border-r border-white/10 flex-1">
          <h1 className={clsx(syneTactile.className, "text-xl")}>
            Idea Goblin
          </h1>
        </div>
      </Sidebar>
      <Container>
        <div className="flex items-center gap-2 p-3 px-4 flex-1">
          <CreateIdeaModal type="inline" />
          <AnalyzeVault />
        </div>
        <div className="md:hidden flex justify-end">
          <SignoutButton />
        </div>
      </Container>
    </header>
  );
}
