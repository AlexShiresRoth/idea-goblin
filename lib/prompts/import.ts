import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";
import { AI_MODELS } from "../ai";
import { BUCKET_CATEGORY_NAMES } from "../constants/bucket-categories";
import type { IdeaBucket } from "../db/schema";
import {
  MAX_IMPORT_DESCRIPTION_LENGTH,
  MAX_IMPORT_ROWS,
  MAX_IMPORT_TITLE_LENGTH,
} from "../import/schema";

import "server-only";

// Batched versions of the single-idea prompts, so an import costs a few calls
// instead of a few per idea.

const DescribedIdeasSchema = z.object({
  ideas: z.array(
    z.object({
      index: z.number(),
      title: z.string(),
      category: z.string(),
      type: z.string(),
      bucketCategory: z.enum(BUCKET_CATEGORY_NAMES),
    }),
  ),
});

export type DescribedIdea = z.infer<
  typeof DescribedIdeasSchema
>["ideas"][number];

export async function describeIdeas(
  client: OpenAI,
  ideas: { index: number; title?: string; description: string }[],
) {
  return client.responses.parse({
    model: AI_MODELS.rank,
    input: [
      {
        role: "system",
        content: `
          You are an idea goblin, that helps people stay grounded with their ideas.
          For each idea, give a short title, a category, a type,
          and the bucket category that best fits the idea's subject.
          If an idea already has a title, return that title unchanged.
          Return every idea once, with its given index.
        `.trim(),
      },
      {
        role: "user",
        content: ideas
          .map(
            (idea) =>
              `index ${idea.index}${idea.title ? ` | title: ${idea.title}` : ""} | ${idea.description}`,
          )
          .join("\n"),
      },
    ],
    text: { format: zodTextFormat(DescribedIdeasSchema, "ideas") },
    reasoning: { effort: "low" },
  });
}

const SortedIdeasSchema = z.object({
  assignments: z.array(
    z.object({
      index: z.number(),
      bucketId: z.number().nullable(),
      newBucketKey: z.string().nullable(),
    }),
  ),
  newBuckets: z.array(
    z.object({
      key: z.string(),
      name: z.string(),
      description: z.string(),
      theme: z.string(),
      category: z.enum(BUCKET_CATEGORY_NAMES),
    }),
  ),
});

export type SortedIdeas = z.infer<typeof SortedIdeasSchema>;

export async function sortIdeasIntoBuckets(
  client: OpenAI,
  buckets: Pick<IdeaBucket, "id" | "name" | "description">[],
  ideas: { index: number; title: string; description: string }[],
) {
  return client.responses.parse({
    model: AI_MODELS.rank,
    input: [
      {
        role: "system",
        content: `
          You sort a batch of new ideas into a user's idea buckets.
          A bucket represents a broader project, product, or concept that multiple related ideas may belong to.

          Rules:
          - Prefer an existing bucket when the idea is a feature, extension, variation, or closely related concept within it.
          - Do NOT match based only on superficial words, category, or type.
          - Do NOT force an idea into an existing bucket when the relationship is weak.
          - When no existing bucket fits, put the idea in a new bucket.
          - Related new ideas should share one new bucket rather than each starting their own.
          - For an existing bucket, set bucketId and leave newBucketKey null.
          - For a new bucket, set newBucketKey to that bucket's key and leave bucketId null.
          - Never invent an ID for an existing bucket.
          - A new bucket has a concise name, a description of the broader concept (not just one idea's title),
            a one to two word theme (e.g. App, Product, Game Development, Music Production),
            and the category that best fits its subject.
          - Assign every idea exactly once, by its index.
        `.trim(),
      },
      {
        role: "user",
        content: `
          NEW IDEAS
          ${ideas.map((idea) => `index ${idea.index} | ${idea.title}: ${idea.description}`).join("\n")}

          EXISTING BUCKETS
          ${
            buckets.length > 0
              ? buckets
                  .map(
                    (bucket) =>
                      `id ${bucket.id} | ${bucket.name}: ${bucket.description.slice(0, 200)}`,
                  )
                  .join("\n")
              : "(none yet)"
          }
        `.trim(),
      },
    ],
    text: { format: zodTextFormat(SortedIdeasSchema, "sorted_ideas") },
    reasoning: { effort: "medium" },
  });
}

const DescribedBucketsSchema = z.object({
  buckets: z.array(
    z.object({
      key: z.string(),
      description: z.string(),
      theme: z.string(),
      category: z.enum(BUCKET_CATEGORY_NAMES),
    }),
  ),
});

// For buckets the user named on import: what their ideas have in common.
export async function describeBuckets(
  client: OpenAI,
  buckets: {
    key: string;
    name: string;
    ideas: { title: string; description: string }[];
  }[],
) {
  return client.responses.parse({
    model: AI_MODELS.rank,
    input: [
      {
        role: "system",
        content: `
          The user grouped these ideas into buckets by hand.
          For each bucket, write a one or two sentence description of what its ideas have in common,
          in light of the bucket's name. If they are only loosely related, say so plainly
          (e.g. "A grab bag of side projects: ...") rather than inventing a theme.
          Also give a one to two word theme (e.g. App, Product, Game Development, Music Production)
          and the category that best fits. Return every bucket once, with its given key.
        `.trim(),
      },
      {
        role: "user",
        content: buckets
          .map(
            (bucket) =>
              `key ${bucket.key} | ${bucket.name}\n${bucket.ideas
                .map((idea) => `- ${idea.title}: ${idea.description}`)
                .join("\n")}`,
          )
          .join("\n\n"),
      },
    ],
    text: { format: zodTextFormat(DescribedBucketsSchema, "buckets") },
    reasoning: { effort: "low" },
  });
}

const TranscribedIdeasSchema = z.object({
  ideas: z.array(
    z.object({
      title: z.string().nullable(),
      description: z.string(),
    }),
  ),
});

// Reads ideas out of a photo of notes or a PDF, for the import preview.
export async function transcribeIdeas(
  client: OpenAI,
  file: { name: string; type: string; data: string },
) {
  const dataUrl = `data:${file.type};base64,${file.data}`;
  return client.responses.parse({
    model: AI_MODELS.rank,
    input: [
      {
        role: "system",
        content: `
          You transcribe ideas from a user's notes: a photo of handwriting, a whiteboard,
          sticky notes, a screenshot, or a document.
          Return each separate idea once, in the order it appears.

          Rules:
          - Keep the user's own words. Fix obvious misspellings, but do not embellish or add detail.
          - Join lines that continue the same idea; split lists into one idea per item.
          - When an idea has a clear heading or name, use it as the title (under ${MAX_IMPORT_TITLE_LENGTH} characters); otherwise leave title null.
          - Keep each description under ${MAX_IMPORT_DESCRIPTION_LENGTH} characters.
          - Skip text that is not an idea: dates, page numbers, headers, signatures, doodle labels.
          - Skip words you cannot read rather than guessing.
          - Return at most ${MAX_IMPORT_ROWS} ideas. If there are none, return an empty list.
        `.trim(),
      },
      {
        role: "user",
        content: [
          file.type === "application/pdf"
            ? { type: "input_file", filename: file.name, file_data: dataUrl }
            : { type: "input_image", image_url: dataUrl, detail: "high" },
        ],
      },
    ],
    text: {
      format: zodTextFormat(TranscribedIdeasSchema, "transcribed_ideas"),
    },
    reasoning: { effort: "low" },
  });
}
