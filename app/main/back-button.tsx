"use client";

import { ArrowLeftIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const ROOT = "/main";

// Analysis details go back to the analysis list; everything else under the
// root (buckets, the analysis list) goes back to the board.
export function backTarget(pathname: string) {
  if (pathname.startsWith("/main/analysis/")) {
    return { href: "/main/analysis", label: "Back to analysis" };
  }
  return { href: ROOT, label: "Back to board" };
}

export default function BackButton() {
  const pathname = usePathname();

  if (pathname === ROOT || !pathname.startsWith(`${ROOT}/`)) {
    return null;
  }

  const { href, label } = backTarget(pathname);

  return (
    <Link
      href={href}
      aria-label={label}
      title={label}
      data-testid="back-button"
      className="flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-sm text-white/60 hover:bg-white/10 hover:text-white transition-colors"
    >
      <ArrowLeftIcon className="w-4 h-4" />
      <span className="hidden md:inline">Back</span>
    </Link>
  );
}
