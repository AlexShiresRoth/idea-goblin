import { getIdeaBuckets } from "@/lib/api/buckets";
import { AuthGuard } from "@/lib/auth/auth-guard";
import { NextResponse } from "next/server";

const DAY_MS = 24 * 60 * 60 * 1000;

function wordCount(text: string) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

// No model call: the vaguest bucket (fewest words) is the best refinement
// candidate, and among equally vague ones the longest untouched wins.
export async function POST() {
  try {
    const session = await AuthGuard();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const buckets = await getIdeaBuckets(session.user.id);
    if (buckets.length === 0) {
      return NextResponse.json({ error: "No buckets found" }, { status: 400 });
    }

    const [bucket] = [...buckets].sort(
      (a, b) =>
        wordCount(a.description) - wordCount(b.description) ||
        a.updatedAt.getTime() - b.updatedAt.getTime(),
    );

    const words = wordCount(bucket.description);
    const days = Math.floor((Date.now() - bucket.updatedAt.getTime()) / DAY_MS);
    const reason =
      days > 0
        ? `Only ${words} words of detail and untouched for ${days} day${days === 1 ? "" : "s"}. The goblin says this one needs sharpening.`
        : `Only ${words} words of detail. The goblin says this one needs sharpening.`;

    return NextResponse.json({
      bucketId: bucket.id,
      name: bucket.name,
      description: bucket.description,
      reason,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to recommend a bucket" },
      { status: 500 },
    );
  }
}
