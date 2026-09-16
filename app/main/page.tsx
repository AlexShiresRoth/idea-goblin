import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function Main() {
  const session = await getSession();

  if (!session) {
    redirect("/");
  }

  return <div>Start Goblinning!</div>;
}
