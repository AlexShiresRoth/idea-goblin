"use client";

import clsx from "clsx";
import { ChartNetwork, LayoutDashboard } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  {
    href: "/main",
    label: "Board",
    icon: LayoutDashboard,
    isActive: (pathname: string) => pathname === "/main",
  },
  {
    href: "/main/analysis",
    label: "Analysis",
    icon: ChartNetwork,
    isActive: (pathname: string) => pathname.startsWith("/main/analysis"),
  },
] as const;

export default function NavLinks({
  onNavigate,
  variant = "sidebar",
}: {
  onNavigate?: () => void;
  variant?: "sidebar" | "sheet";
}) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-2 w-full">
      {LINKS.map((link) => {
        const Icon = link.icon;
        const active = link.isActive(pathname);

        return (
          <Link
            key={link.href}
            href={link.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={clsx(
              "flex items-center gap-2 text-sm transition-colors",
              variant === "sidebar" && "rounded-md px-2 py-1.5",
              variant === "sheet" &&
                "rounded-md border border-white/15 bg-black px-4 py-3",
              active
                ? "bg-white/10 text-white"
                : "text-white/60 hover:bg-white/5 hover:text-white",
            )}
          >
            <Icon className="w-3 h-3" />
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
