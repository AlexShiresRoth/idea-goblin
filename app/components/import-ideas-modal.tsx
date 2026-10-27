"use client";

import {
  parseCsv,
  parsePastedList,
  parseTranscribed,
  type ParsedRow,
  type ParseResult,
} from "@/lib/import/parse";
import {
  MAX_IMPORT_BUCKET_NAME_LENGTH,
  MAX_IMPORT_DESCRIPTION_LENGTH,
  MAX_IMPORT_FILE_BYTES,
  MAX_IMPORT_ROWS,
  MAX_TRANSCRIBE_FILE_BYTES,
  TRANSCRIBE_FILE_TYPES,
  TRANSCRIBE_IMAGE_TYPES,
  type ImportRow,
  type ImportSummary,
  type ImportTarget,
  type TranscribedIdea,
} from "@/lib/import/schema";
import { readNdjson } from "@/lib/ndjson";
import type { BucketOption } from "@/lib/types";
import clsx from "clsx";
import { CameraIcon, Loader2, UploadIcon, XIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import ActionButton from "./action-button";
import { type AnalysisStep, AnalysisSteps } from "./analysis-steps";

type Destination = "auto" | "one" | "column";

type Source = "paste" | "file" | "scan";

const SOURCE_LABELS: Record<Source, string> = {
  paste: "Paste a list",
  file: "Upload CSV",
  scan: "Photo or PDF",
};

// Longest side of a photo sent for reading. Enough for handwriting, and keeps
// phone photos well under the upload limit.
const MAX_SCAN_IMAGE_SIDE = 2048;

// A row's bucket as a <select> value: "auto", "existing:<id>" or
// "named:<name>".
type TargetValue = string;

type PreviewRow = ParsedRow & { included: boolean; override?: TargetValue };

type StreamEvent = {
  type: "status" | "done" | "error";
  step?: string;
  message?: string;
  data?: ImportSummary;
};

const fieldClassName =
  "w-full rounded-md border border-white/15 bg-transparent px-3 py-2 text-sm placeholder:text-white/30 focus:border-white/40 focus:outline-none";

function toTarget(value: TargetValue): ImportTarget {
  if (value.startsWith("existing:")) {
    return { type: "existing", bucketId: Number(value.slice(9)) };
  }
  if (value.startsWith("named:")) {
    return { type: "named", name: value.slice(6) };
  }
  return { type: "auto" };
}

function toPreviewRows({ rows }: ParseResult): PreviewRow[] {
  // Repeats within the import start unticked; the first copy stays in.
  return rows.map((row) => ({
    ...row,
    included: !row.error && row.duplicateOf === undefined,
  }));
}

// Scales a large photo down and re-encodes it as JPEG. Falls back to the
// original when the browser can't decode it.
async function shrinkImage(file: File): Promise<Blob> {
  if (typeof createImageBitmap !== "function") return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(
      1,
      MAX_SCAN_IMAGE_SIDE / Math.max(bitmap.width, bitmap.height),
    );
    if (scale === 1 && file.size <= MAX_TRANSCRIBE_FILE_BYTES) {
      bitmap.close();
      return file;
    }
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas
      .getContext("2d")
      ?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.85),
    );
    return blob ?? file;
  } catch (err) {
    console.error(err);
    return file;
  }
}

function ImportIdeasForm({
  onClose,
  defaultBucket,
}: {
  onClose: () => void;
  defaultBucket?: BucketOption;
}) {
  const router = useRouter();
  const [stage, setStage] = useState<
    "input" | "preview" | "importing" | "summary"
  >("input");
  const [source, setSource] = useState<Source>("paste");
  const [pasteText, setPasteText] = useState("");
  const [fileName, setFileName] = useState<string>();
  const [scanName, setScanName] = useState<string>();
  const [transcribing, setTranscribing] = useState(false);
  const [inputError, setInputError] = useState<string>();
  const [rows, setRows] = useState<PreviewRow[]>([]);
  const [buckets, setBuckets] = useState<BucketOption[]>(
    defaultBucket ? [defaultBucket] : [],
  );
  const [destination, setDestination] = useState<Destination>(
    defaultBucket ? "one" : "auto",
  );
  // For "one": an existing bucket's id, or "new" with a name.
  const [oneBucket, setOneBucket] = useState<string>(
    defaultBucket ? String(defaultBucket.id) : "new",
  );
  const [newBucketName, setNewBucketName] = useState("");
  const [newBucketDescription, setNewBucketDescription] = useState("");
  const [steps, setSteps] = useState<AnalysisStep[]>([]);
  const [error, setError] = useState<string>();
  const [summaries, setSummaries] = useState<ImportSummary[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/buckets/list")
      .then((response) => (response.ok ? response.json() : []))
      .then((data: BucketOption[]) => {
        if (!cancelled && Array.isArray(data) && data.length > 0) {
          setBuckets(data);
        }
      })
      .catch((err) => console.error(err));
    return () => {
      cancelled = true;
    };
  }, []);

  const hasBucketColumn = rows.some((row) => row.bucket);
  const fileBucketNames = useMemo(
    () => [...new Set(rows.flatMap((row) => (row.bucket ? [row.bucket] : [])))],
    [rows],
  );

  function destinationTarget(row: PreviewRow): TargetValue {
    if (destination === "column" && row.bucket) return `named:${row.bucket}`;
    if (destination === "one") {
      return oneBucket === "new"
        ? `named:${newBucketName.trim()}`
        : `existing:${oneBucket}`;
    }
    return "auto";
  }

  const targetFor = (row: PreviewRow) => row.override ?? destinationTarget(row);
  const included = rows.filter((row) => row.included && !row.error);
  // "One new bucket" with no name yet.
  const needsBucketName = included.some((row) => targetFor(row) === "named:");

  function readInput(result: ParseResult) {
    if (result.error) {
      setInputError(result.error);
      return;
    }
    if (result.rows.length === 0) {
      setInputError("No ideas found. Add at least one.");
      return;
    }
    setInputError(undefined);
    const next = toPreviewRows(result);
    setRows(next);
    if (!defaultBucket && next.some((row) => row.bucket)) {
      setDestination("column");
    }
    setStage("preview");
  }

  async function readFile(file: File) {
    setFileName(file.name);
    if (file.size > MAX_IMPORT_FILE_BYTES) {
      setInputError(
        `That file is over ${Math.round(MAX_IMPORT_FILE_BYTES / 1024)}KB.`,
      );
      return;
    }
    readInput(parseCsv(await file.text()));
  }

  async function readScan(file: File) {
    setScanName(file.name);
    // Images can be shrunk here, so only their type is checked up front.
    const isImage = TRANSCRIBE_IMAGE_TYPES.includes(file.type);
    if (!TRANSCRIBE_FILE_TYPES.includes(file.type)) {
      setInputError("Use a PNG, JPEG, WebP or GIF image, or a PDF.");
      return;
    }
    const upload = isImage ? await shrinkImage(file) : file;
    if (upload.size > MAX_TRANSCRIBE_FILE_BYTES) {
      setInputError(
        `That file is over ${MAX_TRANSCRIBE_FILE_BYTES / 1024 / 1024}MB.`,
      );
      return;
    }

    setInputError(undefined);
    setTranscribing(true);
    try {
      const body = new FormData();
      body.append("file", upload, file.name);
      const response = await fetch("/api/ideas/import/transcribe", {
        method: "POST",
        body,
      });
      if (!response.ok) {
        setInputError(
          response.status === 500
            ? "The goblin couldn't read that file."
            : await response.text(),
        );
        return;
      }
      const { ideas } = (await response.json()) as {
        ideas: TranscribedIdea[];
      };
      if (ideas.length === 0) {
        setInputError("The goblin couldn't find any ideas in that file.");
        return;
      }
      readInput(parseTranscribed(ideas));
    } catch (err) {
      console.error(err);
      setInputError("The goblin couldn't read that file.");
    } finally {
      setTranscribing(false);
    }
  }

  function changeDestination(next: Destination) {
    setDestination(next);
    // A new destination applies to every row.
    setRows((current) =>
      current.map((row) => ({ ...row, override: undefined })),
    );
  }

  function updateRow(line: number, change: Partial<PreviewRow>) {
    setRows((current) =>
      current.map((row) => (row.line === line ? { ...row, ...change } : row)),
    );
  }

  async function runImport(importRows: ImportRow[], allowDuplicates = false) {
    setStage("importing");
    setSteps([]);
    setError(undefined);
    try {
      const response = await fetch("/api/ideas/import", {
        method: "POST",
        body: JSON.stringify({ rows: importRows, allowDuplicates }),
      });
      if (!response.ok) {
        setError(
          response.status === 429
            ? await response.text()
            : "The goblin couldn't take that import.",
        );
        return;
      }
      await readNdjson<StreamEvent>(response, (event) => {
        if (event.type === "status" && event.step && event.message) {
          const { step, message } = event;
          setSteps((current) =>
            current.some((item) => item.step === step)
              ? current.map((item) =>
                  item.step === step ? { ...item, message } : item,
                )
              : [...current, { step, message, startedAt: Date.now() }],
          );
        }
        if (event.type === "done" && event.data) {
          const summary = event.data;
          setSummaries((current) => [...current, summary]);
          setStage("summary");
          router.refresh();
        }
        if (event.type === "error") {
          setError(event.message ?? "Import failed");
        }
      });
    } catch (err) {
      console.error(err);
      setError("The goblin couldn't take that import.");
    }
  }

  function startImport() {
    const bucketDescription = newBucketDescription.trim();
    void runImport(
      included.map((row) => {
        const target = toTarget(targetFor(row));
        // The description belongs to the one new bucket typed in above.
        if (
          bucketDescription &&
          target.type === "named" &&
          target.name === newBucketName.trim()
        ) {
          target.description = bucketDescription;
        }
        return {
          ...(row.title && { title: row.title }),
          description: row.description,
          target,
        };
      }),
    );
  }

  // Scanned ideas have no lines to point at, so they're numbered instead.
  const rowLabel = source === "scan" ? "Idea" : "Line";

  const latest = summaries.at(-1);
  const totalCreated = summaries.reduce((sum, item) => sum + item.created, 0);

  return (
    <div
      className="flex flex-col gap-4 rounded-lg border border-white/20 bg-black p-4 md:p-6 w-full md:w-3/4 max-w-5xl max-h-[90dvh] min-h-0"
      data-testid="import-ideas-modal"
    >
      <div className="flex items-center justify-between border-b border-white/20 pb-4 shrink-0">
        <h2 className="text-2xl font-bold">Import ideas</h2>
        <button
          type="button"
          aria-label="Close import"
          data-testid="import-ideas-close"
          onClick={onClose}
          className="hover:cursor-pointer"
        >
          <XIcon className="w-4 h-4" />
        </button>
      </div>

      {stage === "input" && (
        <div className="flex flex-col gap-4">
          <div className="flex gap-2" role="tablist">
            {(["paste", "file", "scan"] as const).map((option) => (
              <button
                key={option}
                type="button"
                role="tab"
                data-testid={`import-source-${option}`}
                aria-selected={source === option}
                disabled={transcribing}
                onClick={() => {
                  setSource(option);
                  setInputError(undefined);
                }}
                className={clsx(
                  "px-3 py-1.5 rounded-md border text-sm transition-colors",
                  source === option
                    ? "border-white/50 bg-white/5"
                    : "border-white/15 text-white/60 hover:border-white/40",
                )}
              >
                {SOURCE_LABELS[option]}
              </button>
            ))}
          </div>

          {source === "paste" ? (
            <div className="flex flex-col gap-2">
              <textarea
                aria-label="Ideas to import"
                data-testid="import-paste-input"
                value={pasteText}
                onChange={(event) => setPasteText(event.target.value)}
                rows={10}
                placeholder={
                  "One idea per line\n- A habit tracker for plants\n- Recipe swaps with neighbours"
                }
                className={fieldClassName}
              />
              <p className="text-xs text-white/40">
                Up to {MAX_IMPORT_ROWS} ideas. List markers like &quot;-&quot;
                or &quot;1.&quot; are dropped.
              </p>
              <div className="flex justify-end">
                <button
                  type="button"
                  disabled={!pasteText.trim()}
                  onClick={() => readInput(parsePastedList(pasteText))}
                  data-testid="import-preview"
                  className="action-button"
                >
                  Preview
                </button>
              </div>
            </div>
          ) : source === "scan" ? (
            <div className="flex flex-col gap-2">
              <label
                className={clsx(
                  "flex flex-col items-center gap-2 rounded-md border border-dashed border-white/20 px-4 py-8 text-sm text-white/60",
                  transcribing
                    ? "opacity-60"
                    : "hover:border-white/40 hover:cursor-pointer",
                )}
              >
                {transcribing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span data-testid="import-transcribing">
                      Reading your notes...
                    </span>
                  </>
                ) : (
                  <>
                    <CameraIcon className="w-4 h-4" />
                    {scanName ?? "Choose a photo or PDF"}
                  </>
                )}
                <input
                  type="file"
                  accept={TRANSCRIBE_FILE_TYPES.join(",")}
                  aria-label="Photo or PDF"
                  data-testid="import-scan-input"
                  disabled={transcribing}
                  className="sr-only"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    // Lets the same file be picked again after an error.
                    event.target.value = "";
                    if (file) void readScan(file);
                  }}
                />
              </label>
              <p className="text-xs text-white/40">
                A photo of handwritten notes, a whiteboard or sticky notes, a
                screenshot, or a PDF. Goblin reads out the ideas for you to
                check before importing. Up to {MAX_IMPORT_ROWS} ideas.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <label className="flex flex-col items-center gap-2 rounded-md border border-dashed border-white/20 px-4 py-8 text-sm text-white/60 hover:border-white/40 hover:cursor-pointer">
                <UploadIcon className="w-4 h-4" />
                {fileName ?? "Choose a CSV file"}
                <input
                  type="file"
                  accept=".csv,text/csv"
                  aria-label="CSV file"
                  data-testid="import-csv-input"
                  className="sr-only"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) void readFile(file);
                  }}
                />
              </label>
              <p className="text-xs text-white/40">
                Columns: <code>description</code> (required), <code>title</code>{" "}
                and <code>bucket</code> (optional), with a header row. Up to{" "}
                {MAX_IMPORT_ROWS} ideas.
              </p>
            </div>
          )}
          {inputError && (
            <p
              className="text-sm text-red-400"
              data-testid="import-input-error"
            >
              {inputError}
            </p>
          )}
        </div>
      )}

      {stage === "preview" && (
        <div className="flex flex-col gap-4 min-h-0">
          <div className="flex flex-col gap-2 shrink-0">
            <label htmlFor="import-destination" className="text-sm">
              Where should they go?
            </label>
            <div className="flex flex-col gap-2 md:flex-row">
              <select
                id="import-destination"
                data-testid="import-destination"
                value={destination}
                onChange={(event) =>
                  changeDestination(event.target.value as Destination)
                }
                className={clsx(fieldClassName, "md:w-64")}
              >
                <option value="auto">Sort them for me</option>
                <option value="one">All into one bucket</option>
                {hasBucketColumn && (
                  <option value="column">
                    Use the file&apos;s bucket column
                  </option>
                )}
              </select>
              {destination === "one" && (
                <select
                  aria-label="Bucket for all ideas"
                  data-testid="import-one-bucket"
                  value={oneBucket}
                  onChange={(event) => {
                    setOneBucket(event.target.value);
                    setRows((current) =>
                      current.map((row) => ({ ...row, override: undefined })),
                    );
                  }}
                  className={clsx(fieldClassName, "md:w-64")}
                >
                  <option value="new">New bucket</option>
                  {buckets.map((bucket) => (
                    <option key={bucket.id} value={bucket.id}>
                      {bucket.name}
                    </option>
                  ))}
                </select>
              )}
              {destination === "one" && oneBucket === "new" && (
                <input
                  aria-label="New bucket name"
                  data-testid="import-new-bucket-name"
                  value={newBucketName}
                  onChange={(event) => setNewBucketName(event.target.value)}
                  maxLength={MAX_IMPORT_BUCKET_NAME_LENGTH}
                  placeholder="New bucket name"
                  className={clsx(fieldClassName, "md:w-64")}
                />
              )}
            </div>
            {destination === "one" && oneBucket === "new" && (
              <input
                aria-label="New bucket description"
                data-testid="import-new-bucket-description"
                value={newBucketDescription}
                onChange={(event) =>
                  setNewBucketDescription(event.target.value)
                }
                maxLength={MAX_IMPORT_DESCRIPTION_LENGTH}
                placeholder="What's it for? (optional, Goblin sums up its ideas if left blank)"
                className={fieldClassName}
              />
            )}
          </div>

          <ul
            className="flex flex-col gap-2 overflow-y-auto min-h-0 pr-1"
            data-testid="import-rows"
          >
            {rows.map((row) => {
              const note = row.error
                ? row.error
                : row.duplicateOf !== undefined
                  ? `Same as ${rowLabel.toLowerCase()} ${row.duplicateOf}`
                  : undefined;
              return (
                <li
                  key={row.line}
                  data-testid="import-row"
                  className={clsx(
                    "flex flex-col gap-2 rounded-md border px-3 py-2 md:flex-row md:items-center",
                    row.error ? "border-red-400/30" : "border-white/10",
                    !row.included && "opacity-60",
                  )}
                >
                  <label className="flex items-start gap-3 min-w-0 flex-1">
                    <input
                      type="checkbox"
                      aria-label={`Include line ${row.line}`}
                      data-testid="import-row-include"
                      checked={row.included && !row.error}
                      disabled={Boolean(row.error)}
                      onChange={(event) =>
                        updateRow(row.line, { included: event.target.checked })
                      }
                      className="mt-1"
                    />
                    <span className="flex flex-col gap-0.5 min-w-0">
                      <span className="text-xs text-white/40">
                        {rowLabel} {row.line}
                        {row.title ? ` · ${row.title}` : ""}
                      </span>
                      <span className="text-sm text-white/80 line-clamp-2">
                        {row.description}
                      </span>
                      {note && (
                        <span
                          className={clsx(
                            "text-xs",
                            row.error ? "text-red-400" : "text-orange-300/80",
                          )}
                        >
                          {note}
                        </span>
                      )}
                    </span>
                  </label>
                  {!row.error && (
                    <select
                      aria-label={`Bucket for line ${row.line}`}
                      data-testid="import-row-bucket"
                      value={targetFor(row)}
                      onChange={(event) =>
                        updateRow(row.line, { override: event.target.value })
                      }
                      className={clsx(fieldClassName, "md:w-56 shrink-0")}
                    >
                      <option value="auto">Sort for me</option>
                      {destination === "one" &&
                        oneBucket === "new" &&
                        newBucketName.trim() && (
                          <option value={`named:${newBucketName.trim()}`}>
                            New: {newBucketName.trim()}
                          </option>
                        )}
                      {fileBucketNames.map((name) => (
                        <option key={name} value={`named:${name}`}>
                          {name}
                        </option>
                      ))}
                      {buckets.map((bucket) => (
                        <option key={bucket.id} value={`existing:${bucket.id}`}>
                          {bucket.name}
                        </option>
                      ))}
                      {targetFor(row) === "named:" && (
                        <option value="named:" disabled>
                          Name the new bucket
                        </option>
                      )}
                    </select>
                  )}
                </li>
              );
            })}
          </ul>

          <div className="flex items-center justify-between gap-2 border-t border-white/20 pt-4 shrink-0">
            <button
              type="button"
              onClick={() => setStage("input")}
              data-testid="import-back"
              className="action-button"
            >
              Back
            </button>
            <button
              type="button"
              disabled={included.length === 0 || needsBucketName}
              onClick={startImport}
              data-testid="import-submit"
              className="flex items-center gap-2 rounded-md border border-white/20 px-4 py-2 text-sm transition-colors enabled:hover:cursor-pointer enabled:hover:bg-green-500 enabled:hover:text-black disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <UploadIcon className="w-3 h-3" />
              Import {included.length} idea{included.length === 1 ? "" : "s"}
            </button>
          </div>
        </div>
      )}

      {stage === "importing" && (
        <div className="flex flex-col gap-4">
          <div className="rounded-lg border border-white/10 bg-white/5 px-4 py-3">
            <AnalysisSteps
              steps={steps}
              running={!error}
              failed={error != null}
            />
            {!error && steps.length === 0 && (
              <p className="flex items-center gap-2 text-sm text-white/60">
                <Loader2 className="w-3 h-3 animate-spin" />
                Waking the goblin...
              </p>
            )}
          </div>
          {error && (
            <>
              <p className="text-sm text-red-400" data-testid="import-error">
                {error}
              </p>
              <div className="flex justify-start">
                <button
                  type="button"
                  onClick={() => setStage("preview")}
                  data-testid="import-back-to-preview"
                  className="action-button"
                >
                  Back to preview
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {stage === "summary" && latest && (
        <div
          className="flex flex-col gap-4 min-h-0 overflow-y-auto"
          data-testid="import-summary"
        >
          <p className="text-lg">
            Added {totalCreated} idea{totalCreated === 1 ? "" : "s"} to the
            hoard.
          </p>
          {latest.buckets.length > 0 && (
            <ul className="flex flex-col gap-1">
              {latest.buckets.map((bucket) => (
                <li
                  key={bucket.id}
                  className="text-sm text-white/70"
                  data-testid="import-summary-bucket"
                >
                  {bucket.name}: {bucket.count} idea
                  {bucket.count === 1 ? "" : "s"}
                  {bucket.created && (
                    <span className="ml-2 rounded-full border border-green-500/40 px-2 text-xs text-green-400">
                      new bucket
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
          {latest.skipped.length > 0 && (
            <div className="flex flex-col gap-2 border-t border-white/10 pt-4">
              <p className="text-sm">
                Skipped {latest.skipped.length} that look like ideas you already
                have:
              </p>
              <ul className="flex flex-col gap-1">
                {latest.skipped.map((item, index) => (
                  <li
                    key={index}
                    className="text-sm text-white/60"
                    data-testid="import-skipped-row"
                  >
                    {item.row.title || item.row.description}
                    <span className="text-white/40">
                      {" "}
                      · like &quot;{item.duplicateOf.title}&quot;
                    </span>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                onClick={() =>
                  runImport(
                    latest.skipped.map((item) => item.row),
                    true,
                  )
                }
                className="action-button w-fit"
                data-testid="import-anyway"
              >
                Import these anyway
              </button>
            </div>
          )}
          <div className="flex justify-end">
            <ActionButton action={onClose} testId="import-done">
              Done
            </ActionButton>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ImportIdeasModal({
  type,
  onTrigger,
  defaultBucket,
}: {
  type: "inline" | "menu" | "bucket";
  onTrigger?: () => void;
  // Imports from inside a bucket go into it unless the user picks otherwise.
  defaultBucket?: BucketOption;
}) {
  const [isOpen, setIsOpen] = useState(false);

  function openModal() {
    onTrigger?.();
    setIsOpen(true);
  }

  return (
    <div>
      {type === "inline" && (
        <ActionButton action={openModal} testId="import-ideas-open">
          <UploadIcon className="w-3 h-3" />
          <span>Import</span>
        </ActionButton>
      )}
      {type === "menu" && (
        <button
          type="button"
          onClick={openModal}
          data-testid="import-ideas-open"
          className="flex items-center gap-2 text-sm w-full rounded-md border border-white/15 bg-black px-4 py-3 text-white/80"
        >
          <UploadIcon className="w-3 h-3" />
          Import ideas
        </button>
      )}
      {type === "bucket" && (
        <button
          type="button"
          onClick={openModal}
          data-testid="import-ideas-open"
          className="flex items-center gap-1 p-2 text-white/50 rounded text-sm hover:cursor-pointer hover:text-green-400/80 transition-colors"
        >
          <UploadIcon className="w-3 h-3" />
          Import
        </button>
      )}
      {isOpen &&
        createPortal(
          <div className="fixed inset-0 bg-black/80 flex justify-center items-center w-screen h-dvh z-100 px-4">
            <ImportIdeasForm
              onClose={() => setIsOpen(false)}
              defaultBucket={defaultBucket}
            />
          </div>,
          document.body,
        )}
    </div>
  );
}
