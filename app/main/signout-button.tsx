"use client";

import { createClient } from "@/lib/auth/supabase-client";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

async function signOut() {
  const client = createClient();
  return await client.auth.signOut();
}

export default function SignoutButton() {
  const router = useRouter();
  const [signOutLoading, setSignOutLoading] = useState(false);
  const handleSignOut = async () => {
    setSignOutLoading(true);
    await signOut();
    setSignOutLoading(false);
    router.refresh();
  };
  return (
    <button
      disabled={signOutLoading}
      onClick={handleSignOut}
      className="text-sm flex items-center gap-2 justify-center bg-white/5 hover:bg-white/10 rounded-md p-2 hover:cursor-pointer"
    >
      {signOutLoading && <Loader2 className="w-3 h-3 animate-spin" />}
      {signOutLoading ? "Signing out..." : "Sign out"}
    </button>
  );
}
