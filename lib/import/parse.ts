import Papa from "papaparse";
import {
  MAX_IMPORT_BUCKET_NAME_LENGTH,
  MAX_IMPORT_DESCRIPTION_LENGTH,
  MAX_IMPORT_ROWS,
  MAX_IMPORT_TITLE_LENGTH,
  MIN_IMPORT_DESCRIPTION_LENGTH,
  type TranscribedIdea,
} from "./schema";

export type ParsedRow = {
  // 1-based line in the pasted text or file, for pointing at problems.
  line: number;
  title?: string;
  description: string;
  bucket?: string;
  // Why the row can't be imported as is.
  error?: string;
  // Line of an earlier row with the same description.
  duplicateOf?: number;
};

export type ParseResult = { rows: ParsedRow[]; error?: string };

const DESCRIPTION_HEADERS = ["description", "idea", "text"];
const TITLE_HEADERS = ["title", "name"];
const BUCKET_HEADERS = ["bucket"];

function rowError(row: Omit<ParsedRow, "line">) {
  if (row.description.length < MIN_IMPORT_DESCRIPTION_LENGTH) {
    return "Description is too short";
  }
  if (row.description.length > MAX_IMPORT_DESCRIPTION_LENGTH) {
    return `Description is over ${MAX_IMPORT_DESCRIPTION_LENGTH} characters`;
  }
  if (row.title && row.title.length > MAX_IMPORT_TITLE_LENGTH) {
    return `Title is over ${MAX_IMPORT_TITLE_LENGTH} characters`;
  }
  if (row.bucket && row.bucket.length > MAX_IMPORT_BUCKET_NAME_LENGTH) {
    return `Bucket name is over ${MAX_IMPORT_BUCKET_NAME_LENGTH} characters`;
  }
  return undefined;
}

function normalize(text: string) {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

// Validates each row, flags repeats within the import, and marks rows past
// the cap so the first MAX_IMPORT_ROWS can still go through.
function finalize(rows: Omit<ParsedRow, "error" | "duplicateOf">[]) {
  const seen = new Map<string, number>();
  return rows.map((row, index): ParsedRow => {
    const error =
      index >= MAX_IMPORT_ROWS
        ? `Over the ${MAX_IMPORT_ROWS}-idea limit for one import`
        : rowError(row);
    const key = normalize(row.description);
    const duplicateOf = seen.get(key);
    if (duplicateOf === undefined) seen.set(key, row.line);
    return { ...row, error, duplicateOf };
  });
}

// One idea per line. List markers like "-", "*", "•" or "1." are dropped.
export function parsePastedList(text: string): ParseResult {
  const rows = text
    .split(/\r?\n/)
    .map((raw, index) => ({
      line: index + 1,
      description: raw.replace(/^\s*(?:[-*•]|\d+[.)])\s+/, "").trim(),
    }))
    .filter((row) => row.description.length > 0);
  return { rows: finalize(rows) };
}

// A header row maps columns by name; without one, a single-column file is
// read as descriptions.
export function parseCsv(text: string): ParseResult {
  const { data } = Papa.parse<string[]>(text.replace(/^﻿/, ""), {
    skipEmptyLines: "greedy",
  });
  if (data.length === 0) return { rows: [], error: "The file is empty" };

  const header = data[0].map((cell) => cell.trim().toLowerCase());
  const column = (names: string[]) =>
    header.findIndex((cell) => names.includes(cell));
  const descriptionColumn = column(DESCRIPTION_HEADERS);

  if (descriptionColumn === -1) {
    if (header.length > 1) {
      return {
        rows: [],
        error:
          'Add a header row with a "description" column (and optionally "title" and "bucket")',
      };
    }
    const rows = data.map((cells, index) => ({
      line: index + 1,
      description: (cells[0] ?? "").trim(),
    }));
    return { rows: finalize(rows.filter((row) => row.description)) };
  }

  const titleColumn = column(TITLE_HEADERS);
  const bucketColumn = column(BUCKET_HEADERS);
  const cell = (cells: string[], index: number) =>
    index === -1 ? undefined : cells[index]?.trim() || undefined;

  const rows = data.slice(1).map((cells, index) => ({
    line: index + 2,
    title: cell(cells, titleColumn),
    description: cell(cells, descriptionColumn) ?? "",
    bucket: cell(cells, bucketColumn),
  }));
  return { rows: finalize(rows) };
}

// Ideas read from a photo or PDF, numbered in the order they were found.
export function parseTranscribed(ideas: TranscribedIdea[]): ParseResult {
  const rows = ideas
    .map((idea, index) => ({
      line: index + 1,
      title: idea.title?.trim() || undefined,
      description: idea.description.trim(),
    }))
    .filter((row) => row.description.length > 0);
  return { rows: finalize(rows) };
}
