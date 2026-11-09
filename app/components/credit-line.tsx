import { type CreditBalance, LOW_CREDIT_SHARE } from "@/lib/constants";
import clsx from "clsx";
import { CoinsIcon } from "lucide-react";

function resetDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

// A run's price, shown on each pathway card before one is picked. Red when
// it costs more than what's left.
export function GoldCost({ cost, short }: { cost: number; short?: boolean }) {
  return (
    <span
      data-testid="gold-cost"
      className={clsx(
        "flex w-fit shrink-0 items-center gap-1 rounded-none border px-1.5 py-px text-[10px]",
        short
          ? "border-red-400/40 text-red-400"
          : "border-amber-300/30 text-amber-300",
      )}
    >
      <CoinsIcon className="w-2.5 h-2.5" />
      {cost} gold
    </span>
  );
}

// The run's price next to what's left this month. Without a cost (no pathway
// picked yet) it shows the balance alone.
export function CreditLine({
  balance,
  cost,
}: {
  balance: CreditBalance;
  cost?: number;
}) {
  const short = cost != null && balance.remaining < cost;
  const low = balance.remaining <= balance.allowance * LOW_CREDIT_SHARE;

  return (
    <p
      data-testid="credit-line"
      className={clsx(
        "flex items-center gap-1.5 text-xs",
        short ? "text-red-400" : low ? "text-amber-300" : "text-white/50",
      )}
    >
      <CoinsIcon className="w-3 h-3 shrink-0" />
      <span>
        {cost != null && `${cost} gold · `}
        {balance.remaining} of {balance.allowance} gold left this month
        {(short || low) && ` · refills ${resetDate(balance.resetsAt)}`}
      </span>
    </p>
  );
}
