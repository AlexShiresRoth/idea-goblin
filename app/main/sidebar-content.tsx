import { User } from "lucide-react";
import NavLinks from "./nav-links";
import SignoutButton from "./signout-button";

export default function SidebarContent({ name }: { name: string }) {
  return (
    <div className="w-full p-4 px-4 flex border-r border-white/10 flex-col items-center gap-2">
      <div className="flex flex-col min-h-full justify-between gap-4 w-11/12">
        <div className="flex flex-col gap-4">
          <button
            className="text-sm flex items-center gap-1"
            data-testid="user-name"
          >
            <User className="w-3 h-3" />
            {name}
          </button>
          <NavLinks />
        </div>
        <SignoutButton />
      </div>
    </div>
  );
}
