import { getSession } from "@/lib/auth";

type Props = {
  children: React.ReactNode;
};

export default async function Sidebar({ children }: Props) {
  const session = await getSession();

  if (!session) {
    return null;
  }

  // Fixed width so the header's sidebar column lines up with the body's.
  return <aside className="hidden md:flex md:w-44 shrink-0">{children}</aside>;
}
