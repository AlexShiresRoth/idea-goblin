"use client";

import { PLAN_NAMES, type Plan } from "@/lib/constants";
import clsx from "clsx";
import { CrownIcon, Loader2, SettingsIcon } from "lucide-react";
import { useContext, useState } from "react";
import { ToastContext } from "../context/toast.provider";

// Scavengers go to checkout; Hoard Lords go to Stripe's billing portal.
export function BillingButton({
  plan,
  className,
}: {
  plan: Plan;
  className?: string;
}) {
  const { setToasts } = useContext(ToastContext);
  const [loading, setLoading] = useState(false);
  const upgrade = plan === "free";

  async function open() {
    setLoading(true);
    try {
      const response = await fetch(
        upgrade ? "/api/stripe/checkout" : "/api/stripe/portal",
        { method: "POST" },
      );
      if (!response.ok) throw new Error("Failed to open billing");
      const { url } = (await response.json()) as { url: string };
      window.location.assign(url);
    } catch (error) {
      console.error(error);
      setToasts([
        {
          id: "billing",
          message: upgrade
            ? "Couldn't open checkout. Try again in a moment."
            : "Couldn't open billing. Try again in a moment.",
          type: "error",
        },
      ]);
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={open}
      disabled={loading}
      data-testid={upgrade ? "upgrade-button" : "manage-billing"}
      className={clsx(
        "flex whitespace-nowrap items-center gap-1.5 rounded-none px-2 py-1.5 text-sm transition-colors hover:cursor-pointer disabled:opacity-60",
        upgrade
          ? "text-amber-300 hover:bg-amber-300/10"
          : "text-white/60 hover:bg-white/10 hover:text-white",
        className,
      )}
    >
      {loading ? (
        <Loader2 className="w-3 h-3 animate-spin" />
      ) : upgrade ? (
        <CrownIcon className="w-3 h-3" />
      ) : (
        <SettingsIcon className="w-3 h-3" />
      )}
      {upgrade ? `Become a ${PLAN_NAMES.pro}` : "Manage billing"}
    </button>
  );
}
