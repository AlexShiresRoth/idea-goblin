import {
  AI_MODELS,
  isRateLimited,
  RATE_LIMITS,
  recordRun,
  responseUsage,
} from "@/lib/ai";
import { ensureProfile } from "@/lib/api/profiles";
import { AuthGuard } from "@/lib/auth/auth-guard";
import {
  MAX_IMPORT_DESCRIPTION_LENGTH,
  MAX_IMPORT_ROWS,
  MAX_IMPORT_TITLE_LENGTH,
  MAX_TRANSCRIBE_FILE_BYTES,
  TRANSCRIBE_FILE_TYPES,
  type TranscribedIdea,
} from "@/lib/import/schema";
import { transcribeIdeas } from "@/lib/prompts/import";
import OpenAI from "openai";

const client = new OpenAI();

// Reads the ideas out of an uploaded photo or PDF. Nothing is saved: the
// ideas go back to the import preview, and from there through the normal
// import.
export async function POST(request: Request) {
  try {
    const session = await AuthGuard();
    if (!session) {
      return new Response("Unauthorized", { status: 401 });
    }

    const form = await request.formData().catch(() => null);
    const file = form?.get("file");
    if (!(file instanceof File)) {
      return new Response("Add a photo or PDF", { status: 400 });
    }
    if (!TRANSCRIBE_FILE_TYPES.includes(file.type)) {
      return new Response("Use a PNG, JPEG, WebP or GIF image, or a PDF", {
        status: 400,
      });
    }
    if (file.size > MAX_TRANSCRIBE_FILE_BYTES) {
      return new Response(
        `That file is over ${MAX_TRANSCRIBE_FILE_BYTES / 1024 / 1024}MB`,
        { status: 413 },
      );
    }

    const profile = await ensureProfile(session);
    if (await isRateLimited(profile.id, "idea-transcribe")) {
      const limit = RATE_LIMITS["idea-transcribe"]!;
      return new Response(
        `The Goblin needs a break: ${limit.max} scans per ${limit.windowMinutes} minutes. Try again later.`,
        { status: 429 },
      );
    }

    const response = await transcribeIdeas(client, {
      name: file.name || "upload",
      type: file.type,
      data: Buffer.from(await file.arrayBuffer()).toString("base64"),
    });
    const ideas: TranscribedIdea[] = (response.output_parsed?.ideas ?? [])
      .map((idea) => ({
        title:
          idea.title?.trim().slice(0, MAX_IMPORT_TITLE_LENGTH) || undefined,
        description: idea.description
          .trim()
          .slice(0, MAX_IMPORT_DESCRIPTION_LENGTH),
      }))
      .filter((idea) => idea.description)
      .slice(0, MAX_IMPORT_ROWS);

    await recordRun({
      profileId: profile.id,
      route: "idea-transcribe",
      model: AI_MODELS.rank,
      usage: responseUsage(response.usage),
      result: { ideas: ideas.length },
    });

    return Response.json({ ideas });
  } catch (error) {
    console.error(error);
    return new Response("Internal Server Error", { status: 500 });
  }
}
