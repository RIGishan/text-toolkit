import { useMemo, useState } from "react";
import { Textarea } from "../../components/ui/Textarea";
import { Input } from "../../components/ui/Input";
import { Button } from "../../components/ui/Button";

type Row = Record<string, string>;

type ParseResult =
  | { ok: true; rows: Row[]; columns: string[] }
  | { ok: false; error: string };

const SAMPLE_JSON = `[
  { "id": 1, "name": "Alice", "role": "Engineer", "country": "USA", "active": true },
  { "id": 2, "name": "Brian", "role": "Designer", "country": "Canada", "active": true },
  { "id": 3, "name": "Chloe", "role": "Engineer", "country": "UK", "active": false }
]`;

const MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024;

function toDisplayValue(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function flattenValue(value: unknown, path: string, output: Row) {
  if (Array.isArray(value)) {
    if (value.length === 0) {
      output[path] = "[]";
      return;
    }

    value.forEach((item, index) => {
      const nextPath = path ? `${path}[${index}]` : `[${index}]`;
      flattenValue(item, nextPath, output);
    });
    return;
  }

  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) {
      output[path] = "{}";
      return;
    }

    entries.forEach(([key, child]) => {
      const nextPath = path ? `${path}.${key}` : key;
      flattenValue(child, nextPath, output);
    });
    return;
  }

  output[path || "value"] = toDisplayValue(value);
}

function flattenRow(input: unknown): Row {
  const row: Row = {};
  flattenValue(input, "", row);
  return row;
}

function normalizeRows(input: unknown): Row[] {
  if (Array.isArray(input)) {
    return input.map((item) => flattenRow(item));
  }

  return [flattenRow(input)];
}

function parseJsonToRows(input: string): ParseResult {
  if (!input.trim()) {
    return { ok: true, rows: [], columns: [] };
  }

  try {
    const parsed = JSON.parse(input) as unknown;
    const rows = normalizeRows(parsed);
    const columns = Array.from(new Set(rows.flatMap((row) => Object.keys(row))));
    return { ok: true, rows, columns };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid JSON.";
    return { ok: false, error: message };
  }
}

export function JsonTableTool() {
  const [input, setInput] = useState<string>(SAMPLE_JSON);
  const [search, setSearch] = useState<string>("");
  const [filterColumn, setFilterColumn] = useState<string>("all");
  const [filterValue, setFilterValue] = useState<string>("");
  const [sourceUrl, setSourceUrl] = useState<string>("");
  const [sourceFeedback, setSourceFeedback] = useState<string>("");
  const [sourceError, setSourceError] = useState<string>("");
  const [isLoadingUrl, setIsLoadingUrl] = useState<boolean>(false);

  const parsed = useMemo(() => parseJsonToRows(input), [input]);

  const filteredRows = useMemo(() => {
    if (!parsed.ok) return [];

    const query = search.trim().toLowerCase();
    const columnQuery = filterValue.trim().toLowerCase();

    return parsed.rows.filter((row) => {
      const cells = Object.values(row);

      const matchesSearch = !query || cells.some((cell) => cell.toLowerCase().includes(query));

      const matchesFilter =
        !columnQuery ||
        (filterColumn === "all"
          ? cells.some((cell) => cell.toLowerCase().includes(columnQuery))
          : (row[filterColumn] ?? "").toLowerCase().includes(columnQuery));

      return matchesSearch && matchesFilter;
    });
  }, [parsed, search, filterValue, filterColumn]);

  const rowCount = parsed.ok ? parsed.rows.length : 0;

  async function onFileUpload(file: File | null) {
    if (!file) return;

    setSourceFeedback("");
    setSourceError("");

    if (file.size > MAX_FILE_SIZE_BYTES) {
      setSourceError("File too large. Max file size is 2 MB.");
      return;
    }

    const text = await file.text();
    setInput(text);
    setSourceFeedback(`Loaded JSON from file: ${file.name}`);
  }

  async function onFetchFromUrl() {
    if (!sourceUrl.trim()) {
      setSourceError("Enter a URL first.");
      return;
    }

    setSourceError("");
    setSourceFeedback("");
    setIsLoadingUrl(true);

    try {
      const response = await fetch(sourceUrl.trim());
      if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}.`);
      }

      const bodyText = await response.text();
      setInput(bodyText);
      setSourceFeedback("Fetched JSON from URL successfully.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to fetch URL.";
      setSourceError(message);
    } finally {
      setIsLoadingUrl(false);
    }
  }

  return (
    <div className="grid gap-6">
      <div className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold text-slate-900">JSON sources</div>
          <Button type="button" onClick={() => setInput(SAMPLE_JSON)}>
            Load sample
          </Button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-white p-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">1) JSON text</div>
            <div className="mt-2 text-xs text-slate-500">Paste raw JSON in the editor below.</div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">2) Upload JSON file</div>
            <div className="mt-2">
              <input
                type="file"
                accept=".json,application/json,text/json"
                onChange={(e) => {
                  void onFileUpload(e.target.files?.[0] ?? null);
                  e.currentTarget.value = "";
                }}
                className="block w-full text-xs text-slate-600 file:mr-3 file:rounded-lg file:border file:border-slate-200 file:bg-white file:px-3 file:py-2 file:text-xs file:font-semibold file:text-slate-700"
                aria-label="Upload JSON file"
              />
              <div className="mt-2 text-xs text-slate-500">Max file size: 2 MB</div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-3 sm:col-span-2">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">3) Fetch from URL</div>
            <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_auto]">
              <Input
                value={sourceUrl}
                onChange={(e) => setSourceUrl(e.target.value)}
                placeholder="https://example.com/data.json"
                aria-label="JSON URL input"
              />
              <Button type="button" onClick={onFetchFromUrl} disabled={isLoadingUrl}>
                {isLoadingUrl ? "Fetching..." : "Fetch URL"}
              </Button>
            </div>
            <div className="mt-2 text-xs text-slate-500">Note: URL must allow browser access (CORS).</div>
          </div>
        </div>

        {sourceFeedback ? <div className="text-xs text-emerald-700">{sourceFeedback}</div> : null}
        {sourceError ? <div className="text-xs text-rose-700">{sourceError}</div> : null}
      </div>

      <div className="grid gap-2">
        <div className="text-sm font-semibold text-slate-900">JSON input editor</div>
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          rows={10}
          spellCheck={false}
          aria-label="JSON input for table view"
          placeholder='Paste JSON array/object here. Example: [{"id":1,"name":"Alice"}]'
        />
        <div className="text-xs text-slate-500">Tip: Best for arrays of objects, but single objects are supported too.</div>
      </div>

      {parsed.ok ? (
        <>
          <div className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-3">
            <div className="sm:col-span-3 text-sm font-semibold text-slate-900">Search & filter</div>

            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search all cells..."
              aria-label="Search all table data"
            />

            <select
              value={filterColumn}
              onChange={(e) => setFilterColumn(e.target.value)}
              className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none"
              aria-label="Filter column"
            >
              <option value="all">Filter in all columns</option>
              {parsed.columns.map((col) => (
                <option key={col} value={col}>
                  {col}
                </option>
              ))}
            </select>

            <Input
              value={filterValue}
              onChange={(e) => setFilterValue(e.target.value)}
              placeholder="Filter value..."
              aria-label="Filter value"
            />

            <div className="sm:col-span-3 text-xs text-slate-600">
              Showing <span className="font-semibold">{filteredRows.length}</span> of <span className="font-semibold">{rowCount}</span> rows.
            </div>
          </div>

          <div className="overflow-auto rounded-2xl border border-slate-200 bg-white">
            <table className="min-w-full border-collapse text-sm">
              <thead className="bg-slate-50">
                <tr>
                  {parsed.columns.map((col) => (
                    <th key={col} className="border-b border-slate-200 px-3 py-2 text-left font-semibold text-slate-700">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredRows.length === 0 ? (
                  <tr>
                    <td colSpan={Math.max(parsed.columns.length, 1)} className="px-3 py-4 text-center text-slate-500">
                      No rows match your search/filter.
                    </td>
                  </tr>
                ) : (
                  filteredRows.map((row, idx) => (
                    <tr key={idx} className="odd:bg-white even:bg-slate-50/40">
                      {parsed.columns.map((col) => (
                        <td key={`${idx}-${col}`} className="max-w-[280px] border-t border-slate-100 px-3 py-2 align-top text-slate-700">
                          <div className="truncate" title={row[col] ?? ""}>
                            {row[col] ?? ""}
                          </div>
                        </td>
                      ))}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
          <div className="font-semibold">Invalid JSON</div>
          <div className="mt-1">{parsed.error}</div>
        </div>
      )}
    </div>
  );
}
