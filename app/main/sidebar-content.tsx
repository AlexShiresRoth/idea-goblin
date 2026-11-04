import { PLAN_NAMES, type Plan } from "@/lib/constants";
import { User } from "lucide-react";
import { BillingButton } from "../components/billing-button";
import NavLinks from "./nav-links";
import SignoutButton from "./signout-button";

export default function SidebarContent({
  name,
  plan,
}: {
  name: string;
  plan: Plan;
}) {
  const firstName = name.split(" ")?.[0];

  return (
    <div className="w-full p-4 flex border-r border-white/10 flex-col gap-2">
      <div className="flex flex-col min-h-full justify-between gap-4 w-full">
        <div className="flex flex-col gap-4">
          <button
            className="text-sm flex items-center gap-1 px-2 min-w-0 truncate"
            data-testid="user-name"
          >
            <User className="w-3 h-3" />
            {firstName}
          </button>
          <NavLinks />
        </div>
        <div className="flex flex-col gap-1">
          <p className="px-2 text-xs text-white/40" data-testid="plan-name">
            {PLAN_NAMES[plan]}
          </p>
          <BillingButton plan={plan} className="text-left" />
          <SignoutButton />
        </div>
      </div>
    </div>
  );
}
