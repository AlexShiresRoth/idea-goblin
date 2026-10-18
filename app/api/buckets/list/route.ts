import { getIdeaBuckets } from "@/lib/api/buckets";
import { AuthGuard } from "@/lib/auth/auth-guard";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const session = await AuthGuard();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const buckets = await getIdeaBuckets(session.user.id);
    return NextResponse.json(
      buckets.map(({ id, name, theme }) => ({ id, name, theme })),
    );
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to load buckets" },
      { status: 500 },
    );
  }
}
