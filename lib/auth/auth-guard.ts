import "server-only";
import { createServerClient } from "./client";

// The signed-in user's session, or null when signed out. Callers return 401
// on null; throwing here would turn every signed-out request into a 500.
export async function AuthGuard() {
  const supabase = await createServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();

  return session ?? null;
}
