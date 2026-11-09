"use client";

import clsx from "clsx";
import { Menu, XIcon } from "lucide-react";
import { useState } from "react";
import AnalyzeVault from "../components/analyze-vault";
import type { Plan } from "@/lib/constants";
import { BillingButton } from "../components/billing-button";
import CreateIdeaModal from "../components/create-idea-modal";
import ImportIdeasModal from "../components/import-ideas-modal";
import NavLinks from "./nav-links";
import SignoutButton from "./signout-button";

export default function MobileNav({
  hasBuckets,
  plan,
}: {
  hasBuckets: boolean;
  plan: Plan;
}) {
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
          data-testid="mobile-nav-backdrop"
          className={clsx(
            "absolute inset-0 bg-background/50 transition-opacity",
            open ? "opacity-100" : "opacity-0",
          )}
        />
        <div
          data-testid="mobile-nav-menu"
          className={clsx(
            "absolute bottom-24 inset-x-4 flex flex-col gap-2 transition-all",
            open
              ? "opacity-100 translate-y-0 bg-background"
              : "opacity-0 translate-y-3 pointer-events-none",
          )}
        >
          <NavLinks variant="sheet" onNavigate={() => setOpen(false)} />
          <CreateIdeaModal type="menu" onTrigger={() => setOpen(false)} />
          <ImportIdeasModal type="menu" onTrigger={() => setOpen(false)} />
          <AnalyzeVault
            variant="menu"
            hasBuckets={hasBuckets}
            onTrigger={() => setOpen(false)}
          />
          <div className="flex flex-col rounded-none border border-white/15 bg-background px-2 py-1">
            <BillingButton plan={plan} />
            <SignoutButton />
          </div>
        </div>
      </div>
      <button
        type="button"
        aria-expanded={open}
        aria-label={open ? "Close menu" : "Open menu"}
        onClick={() => setOpen((current) => !current)}
        data-testid="mobile-nav-toggle"
        className="fixed bottom-5 right-5 z-50 flex items-center justify-center w-12 h-12 rounded-none bg-accent text-background shadow-md"
      >
        {open ? <XIcon className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </button>
    </div>
  );
}
