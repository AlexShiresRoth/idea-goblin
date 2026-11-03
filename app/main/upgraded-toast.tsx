"use client";

import { MONTHLY_CREDITS, PLAN_NAMES } from "@/lib/constants";
import { useRouter } from "next/navigation";
import { useContext, useEffect } from "react";
import { ToastContext } from "../context/toast.provider";

// After checkout: welcome the new Hoard Lord once, then drop the query param
// so a reload doesn't toast again.
export function UpgradedToast() {
  const { setToasts } = useContext(ToastContext);
  const router = useRouter();

  useEffect(() => {
    setToasts([
      {
        id: "upgraded",
        message: `Welcome, ${PLAN_NAMES.pro}. ${MONTHLY_CREDITS.pro} gold a month is yours to spend.`,
        type: "success",
      },
    ]);
    router.replace("/main");
  }, [setToasts, router]);

  return null;
}
