import { unstable_rethrow } from "next/navigation";
import "server-only";
import { createServerClient } from "./client";

export async function getSession() {
  try {
    const supabase = await createServerClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return null;
    }

    return user;
  } catch (error) {
    unstable_rethrow(error);
    console.error(error);
    return null;
  }
}
