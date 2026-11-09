"use client";

import { useState } from "react";

import { createObject } from "@/lib/actions/objects";
import { OBJECT_TYPES } from "@/lib/validation/object";

interface ImportRow {
  line: number;
  object_type: string;
  title: string;
  description?: string;
  approximate_date?: string;
  location_in_church?: string;
  materials?: string;
  dimensions?: string;
  condition_notes?: string;
  default_language?: string;
}

interface ImportResult {
  line: number;
  title: string;
  publicId?: string;
  error?: string;
}

export function ObjectImporter({
  churches,
  languages,
}: {
  churches: { id: string; name: string }[];
  languages: { code: string; name: string }[];
}) {
  const [churchId, setChurchId] = useState(churches[0]?.id ?? "");
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [results, setResults] = useState<ImportResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);

  async function readFile(selected: File | null) {
    setRows([]);
    setResults([]);
    setError(null);
    if (!selected) return;
    if (selected.size > 2 * 1024 * 1024) {
      setError("CSV files must be 2 MB or smaller.");
      return;
    }
    try {
      const parsed = parseInventory(await selected.text());
      if (parsed.length === 0) throw new Error("The CSV contains no inventory rows.");
      if (parsed.length > 250) throw new Error("Import up to 250 objects per file.");
      const invalid = parsed.find(
        (row) => !OBJECT_TYPES.includes(row.object_type as (typeof OBJECT_TYPES)[number]),
      );
      if (invalid)
        throw new Error(`Line ${invalid.line}: unknown object_type “${invalid.object_type}”.`);
      const missingTitle = parsed.find((row) => !row.title);
      if (missingTitle) throw new Error(`Line ${missingTitle.line}: title is required.`);
      const unknownLanguage = parsed.find(
        (row) =>
          row.default_language &&
          !languages.some((language) => language.code === row.default_language),
      );
      if (unknownLanguage)
        throw new Error(`Line ${unknownLanguage.line}: default_language is not active.`);
      setRows(parsed);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not read this CSV file.");
    }
  }

  async function importRows() {
    if (!rows.length || busy) return;
    setBusy(true);
    setError(null);
    setResults([]);
    setProgress(0);
    const completed: ImportResult[] = [];
    for (const row of rows) {
      const result = await createObject({
        church_id: churchId,
        object_type: row.object_type as (typeof OBJECT_TYPES)[number],
        default_language: row.default_language || "en",
        title: row.title,
        description: row.description,
        approximate_date: row.approximate_date,
        location_in_church: row.location_in_church,
        materials: row.materials,
        dimensions: row.dimensions,
        condition_notes: row.condition_notes,
      });
      completed.push(
        result.ok
          ? { line: row.line, title: row.title, publicId: result.data.publicId }
          : { line: row.line, title: row.title, error: result.error.message },
      );
      setResults([...completed]);
      setProgress(completed.length);
    }
    setBusy(false);
  }

  const successes = results.filter((result) => result.publicId).length;
  return (
    <section className="flex flex-col gap-5">
      <header>
        <p className="text-crimson text-xs font-bold tracking-[0.18em] uppercase">
          Inventory import
        </p>
        <h2 className="mt-1 font-serif text-2xl">Import church inventory</h2>
        <p className="text-ink-muted mt-2 max-w-3xl text-sm leading-relaxed">
          Import up to 250 records at a time. Each row becomes a draft with a permanent QR ID;
          review, attach sources and images, and submit each record through the church approval
          workflow.
        </p>
      </header>

      <a
        href="/templates/church-icon-inventory.csv"
        download
        className="text-crimson w-fit text-sm font-semibold underline underline-offset-4"
      >
        Download the CSV template
      </a>

      <label className="text-ink-soft flex max-w-xl flex-col gap-2 text-sm font-medium">
        Church
        <select
          value={churchId}
          onChange={(event) => setChurchId(event.target.value)}
          disabled={busy}
          className="border-sand-deep bg-card rounded-md border px-3 py-2"
        >
          {churches.map((church) => (
            <option key={church.id} value={church.id}>
              {church.name}
            </option>
          ))}
        </select>
      </label>

      <label className="border-sand bg-card flex flex-col gap-2 rounded-xl border p-5 text-sm font-medium">
        Choose a filled CSV file
        <input
          type="file"
          accept=".csv,text/csv"
          disabled={busy}
          onChange={(event) => void readFile(event.target.files?.[0] ?? null)}
        />
        <span className="text-ink-muted text-xs font-normal">
          UTF‑8 CSV. Include the header row. Every imported object starts as an unpublished draft.
        </span>
      </label>

      {error ? (
        <p role="alert" className="border-crimson text-crimson rounded-lg border p-3 text-sm">
          {error}
        </p>
      ) : null}

      {rows.length ? (
        <section className="border-sand bg-card flex flex-col gap-4 rounded-xl border p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-ink-soft text-sm">
              <strong>{rows.length}</strong> object records ready for import
            </p>
            <button
              type="button"
              onClick={() => void importRows()}
              disabled={busy || !churchId}
              className="bg-crimson rounded-lg px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
            >
              {busy ? `Importing ${progress} of ${rows.length}…` : "Import as drafts"}
            </button>
          </div>
          <ul className="divide-sand max-h-72 divide-y overflow-auto text-sm">
            {rows.slice(0, 25).map((row) => (
              <li key={row.line} className="flex justify-between gap-4 py-2">
                <span className="truncate">{row.title}</span>
                <span className="text-ink-muted shrink-0">
                  {row.object_type} · line {row.line}
                </span>
              </li>
            ))}
          </ul>
          {rows.length > 25 ? (
            <p className="text-ink-muted text-xs">Showing the first 25 of {rows.length} records.</p>
          ) : null}
        </section>
      ) : null}

      {results.length ? (
        <section className="flex flex-col gap-2" aria-live="polite">
          <h3 className="text-ink font-semibold">
            Import results: {successes} of {results.length} added
          </h3>
          <ul className="border-sand bg-card max-h-72 overflow-auto rounded-xl border text-sm">
            {results.map((result) => (
              <li
                key={result.line}
                className="border-sand flex flex-wrap justify-between gap-2 border-b px-4 py-3 last:border-b-0"
              >
                <span>
                  {result.title} · line {result.line}
                </span>
                <span
                  className={
                    result.publicId ? "text-ink-muted font-mono text-xs" : "text-crimson text-xs"
                  }
                >
                  {result.publicId ?? result.error}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </section>
  );
}

function parseInventory(csv: string): ImportRow[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  const input = csv.replace(/^\uFEFF/, "");
  for (let index = 0; index < input.length; index += 1) {
    const character = input[index];
    if (quoted) {
      if (character === '"' && input[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        cell += character;
      }
    } else if (character === '"') {
      quoted = true;
    } else if (character === ",") {
      row.push(cell.trim());
      cell = "";
    } else if (character === "\n" || character === "\r") {
      if (character === "\r" && input[index + 1] === "\n") index += 1;
      row.push(cell.trim());
      if (row.some(Boolean)) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += character;
    }
  }
  if (quoted) throw new Error("A quoted CSV value is missing its closing quote.");
  row.push(cell.trim());
  if (row.some(Boolean)) rows.push(row);
  if (!rows.length) throw new Error("The CSV file is empty.");

  const headers = rows[0].map((header) => header.toLowerCase());
  if (!headers.includes("object_type") || !headers.includes("title")) {
    throw new Error("The CSV must include object_type and title columns.");
  }
  const allowed = new Set([
    "object_type",
    "title",
    "description",
    "approximate_date",
    "location_in_church",
    "materials",
    "dimensions",
    "condition_notes",
    "default_language",
  ]);
  const unsupported = headers.find((header) => !allowed.has(header));
  if (unsupported) throw new Error(`Unknown CSV column “${unsupported}”.`);

  return rows.slice(1).map((values, index) => {
    const fields = Object.fromEntries(
      headers.map((header, column) => [header, values[column] ?? ""]),
    );
    return { ...fields, line: index + 2 } as ImportRow;
  });
}
