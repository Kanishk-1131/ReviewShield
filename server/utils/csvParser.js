import { parse } from "csv-parse/sync";

/**
 * Parses an uploaded CSV buffer into an array of review strings.
 * Accepts a "review" / "text" / "text_" column (case-insensitive);
 * falls back to the first column if no matching header is found.
 */
export const parseReviewsCsv = (buffer) => {
  const records = parse(buffer, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });

  if (records.length === 0) return [];

  const headerKeys = Object.keys(records[0]);
  const textKey =
    headerKeys.find((k) => ["review", "text", "text_", "reviewtext"].includes(k.toLowerCase())) ||
    headerKeys[0];

  return records
    .map((r) => (r[textKey] || "").toString().trim())
    .filter((t) => t.length > 0);
};
