import { getCreditBalance } from "@/lib/api/credits";
import { AuthGuard } from "@/lib/auth/auth-guard";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const session = await AuthGuard();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json(await getCreditBalance(session.user.id));
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to load credits" },
      { status: 500 },
    );
  }
}
