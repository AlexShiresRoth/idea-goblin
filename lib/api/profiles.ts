import type { Session } from "@supabase/supabase-js";
import { eq } from "drizzle-orm";
import "server-only";
import { db } from "../db";
import { profileTable } from "../db/schema";

// A user's first write (a new idea or an import) creates their profile.
export async function ensureProfile(session: Session) {
  const [profile] = await db
    .select()
    .from(profileTable)
    .where(eq(profileTable.id, session.user.id));
  if (profile) return profile;

  const [created] = await db
    .insert(profileTable)
    .values({
      id: session.user.id,
      name: session.user.user_metadata.name || "Goblinner",
      email: session.user.email as string,
      activeIdeasAmt: 2,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning();
  return created;
}
