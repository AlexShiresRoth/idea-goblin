import { getSession } from "@/lib/auth";

type Props = {
  children: React.ReactNode;
};

export default async function Sidebar({ children }: Props) {
  const session = await getSession();

  if (!session) {
    return null;
  }

  return <aside className="hidden md:flex flex-1">{children}</aside>;
}
