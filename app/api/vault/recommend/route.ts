import { getTopLevelIdeasForProfile } from "@/lib/api/ideas";
import { AuthGuard } from "@/lib/auth/auth-guard";
import { NextResponse } from "next/server";
import { OpenAI } from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";

const client = new OpenAI();

const RecommendSchema = z.object({
  idea_id: z.number(),
  reason: z.string(),
});

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

    const response = await client.responses.parse({
      model: "gpt-6-astra",
      input: [
        {
          role: "system",
          content:
            "Pick the one idea that would benefit most from refinement. Prefer ideas that are promising but vague, broad, or ready to evolve. Use the given idea_id.",
        },
        {
          role: "user",
          content: ideas
            .map(
              (idea) =>
                `id: ${idea.id}\ntitle: ${idea.title}\ndescription: ${idea.description}`,
            )
            .join("\n\n"),
        },
      ],
      text: { format: zodTextFormat(RecommendSchema, "recommend") },
    });

    const parsed = response.output_parsed;
    if (!parsed) {
      return NextResponse.json(
        { error: "No recommendation returned" },
        { status: 500 },
      );
    }

    const idea = ideas.find((item) => item.id === parsed.idea_id);
    if (!idea) {
      return NextResponse.json(
        { error: "Recommended idea was not in the vault" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      ideaId: idea.id,
      title: idea.title,
      description: idea.description,
      reason: parsed.reason,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to recommend an idea" },
      { status: 500 },
    );
  }
}
