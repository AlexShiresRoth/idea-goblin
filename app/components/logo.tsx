import clsx from "clsx";

import { Syne_Tactile } from "next/font/google";

const syneTactile = Syne_Tactile({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-syne-tactile",
});

export default function Logo({ dark }: { dark?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <span
        className={clsx(
          syneTactile.className,
          "w-8 h-8 font-bold rounded-none bg-accent text-background flex items-center justify-center border-4 border-accent/90",
        )}
      >
        IG
      </span>
      <p
        className={clsx("uppercase", dark ? "text-zinc-700" : "text-zinc-300")}
      >
        Idea Goblin
      </p>
    </div>
  );
}
