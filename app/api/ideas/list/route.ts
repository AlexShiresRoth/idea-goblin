import { getTopLevelIdeasForProfile } from "@/lib/api/ideas";
import { AuthGuard } from "@/lib/auth/auth-guard";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const session = await AuthGuard();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const ideas = await getTopLevelIdeasForProfile(session.user.id);
    return NextResponse.json(ideas);
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to load ideas" },
      { status: 500 },
    );
  }
}
