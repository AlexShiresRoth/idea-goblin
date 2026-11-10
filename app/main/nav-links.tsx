"use client";

import clsx from "clsx";
import { ChartNetwork, LayoutDashboard, Trash2 } from "lucide-react";
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
  {
    href: "/main/trash",
    label: "Trash",
    icon: Trash2,
    isActive: (pathname: string) => pathname.startsWith("/main/trash"),
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
    <nav className="flex flex-col gap-2 w-full" data-testid="nav-links">
      {LINKS.map((link) => {
        const Icon = link.icon;
        const active = link.isActive(pathname);

        return (
          <Link
            key={link.href}
            href={link.href}
            onClick={onNavigate}
            data-testid={`nav-link-${link.label.toLowerCase()}`}
            aria-current={active ? "page" : undefined}
            className={clsx(
              "flex items-center gap-2 text-sm transition-colors",
              variant === "sidebar" && "rounded-none px-2 py-1.5",
              variant === "sheet" &&
                "rounded-none border border-white/15 bg-background px-4 py-3",
              active
                ? "bg-accent/10 text-accent"
                : "text-white/60 hover:bg-accent/5 hover:text-accent",
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
