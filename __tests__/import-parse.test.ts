import { parseCsv, parsePastedList } from "@/lib/import/parse";
import { describe, expect, it } from "vitest";

describe("parsePastedList", () => {
  it("reads one idea per line, dropping list markers and blank lines", () => {
    const { rows } = parsePastedList(
      "- Plant habit tracker\n\n* Recipe swaps\n• Bike repair map\n3. Board game cafe\n4) Podcast clips",
    );

    expect(rows.map((row) => [row.line, row.description])).toEqual([
      [1, "Plant habit tracker"],
      [3, "Recipe swaps"],
      [4, "Bike repair map"],
      [5, "Board game cafe"],
      [6, "Podcast clips"],
    ]);
    expect(rows.every((row) => !row.error)).toBe(true);
  });

  it("flags repeats and rows that are too short", () => {
    const { rows } = parsePastedList("Recipe swaps\nok\nrecipe   SWAPS");

    expect(rows[1].error).toBe("Description is too short");
    expect(rows[2].duplicateOf).toBe(1);
    expect(rows[0].duplicateOf).toBeUndefined();
  });

  it("marks rows past the import cap", () => {
    const text = Array.from({ length: 102 }, (_, i) => `Idea number ${i}`).join(
      "\n",
    );
    const { rows } = parsePastedList(text);

    expect(rows[99].error).toBeUndefined();
    expect(rows[100].error).toBe("Over the 100-idea limit for one import");
    expect(rows[101].error).toBeDefined();
  });
});

describe("parseCsv", () => {
  it("maps columns by header, in any order and case", () => {
    const { rows, error } = parseCsv(
      'Bucket,Description,Title\nGames,"A co-op game, with dogs",Dog co-op\n,Plain idea here,\n',
    );

    expect(error).toBeUndefined();
    expect(rows).toEqual([
      {
        line: 2,
        title: "Dog co-op",
        description: "A co-op game, with dogs",
        bucket: "Games",
        error: undefined,
        duplicateOf: undefined,
      },
      {
        line: 3,
        title: undefined,
        description: "Plain idea here",
        bucket: undefined,
        error: undefined,
        duplicateOf: undefined,
      },
    ]);
  });

  it("handles a byte order mark and line breaks inside quotes", () => {
    const { rows } = parseCsv('﻿description\n"Line one\nline two"\n');

    expect(rows).toHaveLength(1);
    expect(rows[0].description).toBe("Line one\nline two");
  });

  it("reads a single headerless column as descriptions", () => {
    const { rows } = parseCsv("First idea here\nSecond idea here\n");

    expect(rows.map((row) => row.description)).toEqual([
      "First idea here",
      "Second idea here",
    ]);
  });

  it("asks for a header when several columns have none", () => {
    const result = parseCsv("Idea one,Games\nIdea two,Music\n");

    expect(result.rows).toEqual([]);
    expect(result.error).toMatch(/header row with a "description" column/);
  });

  it("flags rows with an overlong description", () => {
    const { rows } = parseCsv(`description\n${"x".repeat(501)}\n`);

    expect(rows[0].error).toBe("Description is over 500 characters");
  });

  it("reports an empty file", () => {
    expect(parseCsv("").error).toBe("The file is empty");
  });
});
