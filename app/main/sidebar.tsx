import { getSession } from "@/lib/auth";
import SidebarContent from "./sidebar-content";

export default async function Sidebar() {
  const session = await getSession();

  if (!session) {
    return null;
  }

  return <SidebarContent name={session.user_metadata?.name} />;
}
