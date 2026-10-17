import { ChartNetwork, User } from "lucide-react";
import Link from "next/link";
import SignoutButton from "./signout-button";

export default function SidebarContent({ name }: { name: string }) {
  return (
    <div className="w-full p-4 px-4 flex border-r border-white/10 flex-col items-center gap-2">
      <div className="flex flex-col min-h-full justify-between gap-4">
        <div className="flex flex-col gap-4">
          <button className="text-sm flex items-center gap-1">
            <User className="w-3 h-3" />
            {name}
          </button>
          <Link
            href="/main/analysis"
            className="text-sm flex items-center gap-1"
          >
            <ChartNetwork className="w-3 h-3" />
            Analysis
          </Link>
        </div>
        <SignoutButton />
      </div>
    </div>
  );
}
