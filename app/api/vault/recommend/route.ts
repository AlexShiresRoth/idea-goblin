import { getTopLevelIdeasForProfile } from "@/lib/api/ideas";
import { AuthGuard } from "@/lib/auth/auth-guard";
import { NextResponse } from "next/server";

const DAY_MS = 24 * 60 * 60 * 1000;

function wordCount(text: string) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

// No model call: the vaguest idea (fewest words) is the best refinement
// candidate, and among equally vague ones the longest untouched wins.
export async function POST() {
  try {
    const session = await AuthGuard();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const ideas = await getTopLevelIdeasForProfile(session.user.id);
    if (ideas.length === 0) {
      return NextResponse.json({ error: "No ideas found" }, { status: 400 });
    }

    const [idea] = [...ideas].sort(
      (a, b) =>
        wordCount(a.description) - wordCount(b.description) ||
        a.updatedAt.getTime() - b.updatedAt.getTime(),
    );

    const words = wordCount(idea.description);
    const days = Math.floor((Date.now() - idea.updatedAt.getTime()) / DAY_MS);
    const reason =
      days > 0
        ? `Only ${words} words of detail and untouched for ${days} day${days === 1 ? "" : "s"}. A good one to sharpen.`
        : `Only ${words} words of detail. A good one to sharpen.`;

    return NextResponse.json({
      ideaId: idea.id,
      title: idea.title,
      description: idea.description,
      reason,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to recommend an idea" },
      { status: 500 },
    );
  }
}
