"use client";

import clsx from "clsx";
import { Menu, XIcon } from "lucide-react";
import { useState } from "react";
import AnalyzeVault from "../components/analyze-vault";
import CreateIdeaModal from "../components/create-idea-modal";
import NavLinks from "./nav-links";
import SignoutButton from "./signout-button";

export default function MobileNav() {
  const [open, setOpen] = useState(false);

  return (
    <div className="md:hidden">
      <div
        className={clsx(
          "fixed inset-0 z-40",
          open ? "pointer-events-auto" : "pointer-events-none",
        )}
      >
        <button
          type="button"
          aria-label="Close menu"
          onClick={() => setOpen(false)}
          className={clsx(
            "absolute inset-0 bg-black/50 transition-opacity",
            open ? "opacity-100" : "opacity-0",
          )}
        />
        <div
          className={clsx(
            "absolute bottom-24 inset-x-4 flex flex-col gap-2 transition-all",
            open
              ? "opacity-100 translate-y-0"
              : "opacity-0 translate-y-3 pointer-events-none",
          )}
        >
          <NavLinks variant="sheet" onNavigate={() => setOpen(false)} />
          <CreateIdeaModal type="menu" onTrigger={() => setOpen(false)} />
          <AnalyzeVault variant="menu" onTrigger={() => setOpen(false)} />
          <div className="rounded-md border border-white/15 bg-black px-2">
            <SignoutButton />
          </div>
        </div>
      </div>
      <button
        type="button"
        aria-expanded={open}
        aria-label={open ? "Close menu" : "Open menu"}
        onClick={() => setOpen((current) => !current)}
        className="fixed bottom-5 right-5 z-50 flex items-center justify-center w-12 h-12 rounded-full bg-green-500 text-black shadow-md"
      >
        {open ? <XIcon className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </button>
    </div>
  );
}
