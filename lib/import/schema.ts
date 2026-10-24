import { z } from "zod";

// Shared by the import preview (browser) and the import route (server), so
// both apply the same limits.
export const MAX_IMPORT_ROWS = 100;
export const MAX_IMPORT_FILE_BYTES = 256 * 1024;
// Photos and PDFs of notes, read by the model. Kept under Vercel's 4.5MB
// request body limit.
export const MAX_TRANSCRIBE_FILE_BYTES = 4 * 1024 * 1024;
export const TRANSCRIBE_IMAGE_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
];
export const TRANSCRIBE_FILE_TYPES = [
  ...TRANSCRIBE_IMAGE_TYPES,
  "application/pdf",
];
export const MIN_IMPORT_DESCRIPTION_LENGTH = 3;
// Same limits as adding or editing a single idea.
export const MAX_IMPORT_DESCRIPTION_LENGTH = 500;
export const MAX_IMPORT_TITLE_LENGTH = 200;
export const MAX_IMPORT_BUCKET_NAME_LENGTH = 100;

// Where an imported idea goes: Goblin sorts it, an existing bucket by id, or
// a bucket by name (matched to an existing one, or created).
export const ImportTargetSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("auto") }),
  z.object({
    type: z.literal("existing"),
    bucketId: z.number().int().positive(),
  }),
  z.object({
    type: z.literal("named"),
    name: z.string().trim().min(1).max(MAX_IMPORT_BUCKET_NAME_LENGTH),
    // For a new bucket; without one, Goblin describes it from its ideas.
    description: z
      .string()
      .trim()
      .max(MAX_IMPORT_DESCRIPTION_LENGTH)
      .optional(),
  }),
]);

export const ImportRowSchema = z.object({
  title: z.string().trim().max(MAX_IMPORT_TITLE_LENGTH).optional(),
  description: z
    .string()
    .trim()
    .min(MIN_IMPORT_DESCRIPTION_LENGTH)
    .max(MAX_IMPORT_DESCRIPTION_LENGTH),
  target: ImportTargetSchema,
});

export const ImportRequestSchema = z.object({
  rows: z.array(ImportRowSchema).min(1).max(MAX_IMPORT_ROWS),
  // Set by "import anyway" to keep ideas that look like existing ones.
  allowDuplicates: z.boolean().optional(),
});

export type TranscribedIdea = { title?: string; description: string };

export type ImportTarget = z.infer<typeof ImportTargetSchema>;
export type ImportRow = z.infer<typeof ImportRowSchema>;

export type ImportSummary = {
  created: number;
  buckets: { id: number; name: string; created: boolean; count: number }[];
  // Left out because they look like ideas already in the vault.
  skipped: { row: ImportRow; duplicateOf: { id: number; title: string } }[];
};
