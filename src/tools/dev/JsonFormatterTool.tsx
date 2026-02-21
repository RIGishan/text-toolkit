import { useMemo, useState } from "react";
import { Textarea } from "../../components/ui/Textarea";
import { Button } from "../../components/ui/Button";
import { Toggle } from "../../components/ui/Toggle";
import { downloadTextFile } from "../../lib/download";
import { bytesOfUtf8, formatBytes } from "../../lib/text";
import { useDebouncedValue } from "../../lib/useDebouncedValue";

type Mode = "pretty" | "minify";

function tryGetJsonErrorPosition(message: string): number | null {
  const m = message.match(/at position (\d+)/i);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : null;
}

function posToLineCol(input: string, pos: number): { line: number; col: number } {
  let line = 1;
  let col = 1;
  for (let i = 0; i < input.length && i < pos; i++) {
    if (input.charCodeAt(i) === 10) {
      line++;
      col = 1;
    } else {
      col++;
    }
  }
  return { line, col };
}

function buildPointerSnippet(input: string, pos: number): { snippet: string; caretLine: string } {
  const start = Math.max(0, pos - 40);
  const end = Math.min(input.length, pos + 40);
  const snippet = input.slice(start, end).replace(/\r/g, "");
  const caretIndex = Math.max(0, pos - start);
  const caretLine = " ".repeat(Math.min(caretIndex, 80)) + "^";
  return { snippet, caretLine };
}

function sortKeysDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeysDeep);
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const sorted: Record<string, unknown> = {};
    for (const k of Object.keys(obj).sort((a, b) => a.localeCompare(b))) {
      sorted[k] = sortKeysDeep(obj[k]);
    }
    return sorted;
  }
  return value;
}

export function JsonFormatterTool() {
  const [input, setInput] = useState<string>("");
  const [mode, setMode] = useState<Mode>("pretty");
  const [sortKeys, setSortKeys] = useState<boolean>(false);

  const inputBytes = useMemo(() => bytesOfUtf8(input), [input]);
  const warnLarge = inputBytes > 2 * 1024 * 1024;
  const hardCap = 5 * 1024 * 1024;
  const overCap = inputBytes > hardCap;

  const debouncedInput = useDebouncedValue(input, 180);

  const result = useMemo(() => {
    if (!debouncedInput.trim()) {
      return { ok: true as const, output: "", info: "Paste JSON to format and validate." };
    }
    if (overCap) {
      return {
        ok: false as const,
        output: "",
        error:
          `Input is ${formatBytes(inputBytes)} which exceeds the 5 MB cap for this tool. ` +
          `Reduce the text size to continue.`
      };
    }

    try {
      const parsed = JSON.parse(debouncedInput) as unknown;
      const normalized = sortKeys ? sortKeysDeep(parsed) : parsed;

      const output =
        mode === "minify"
          ? JSON.stringify(normalized)
          : JSON.stringify(normalized, null, 2);

      return { ok: true as const, output, info: "Valid JSON." };
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Invalid JSON.";
      const pos = e instanceof Error ? tryGetJsonErrorPosition(e.message) : null;

      if (pos != null) {
        const { line, col } = posToLineCol(debouncedInput, pos);
        const { snippet, caretLine } = buildPointerSnippet(debouncedInput, pos);
        return {
          ok: false as const,
          output: "",
          error: `Invalid JSON at line ${line}, col ${col}. ${msg}`,
          details: `${snippet}\n${caretLine}`
        };
      }

      return {
        ok: false as const,
        output: "",
        error: `Invalid JSON. ${msg}`
      };
    }
  }, [debouncedInput, mode, sortKeys, overCap, inputBytes]);

  const canCopyDownload = result.ok && result.output.length > 0;

  async function onCopy() {
    if (!canCopyDownload) return;
    await navigator.clipboard.writeText(result.output);
  }

  function onDownload() {
    if (!canCopyDownload) return;
    downloadTextFile(mode === "minify" ? "data.min.json" : "data.pretty.json", result.output);
  }

  function onReset() {
    setInput("");
    setMode("pretty");
    setSortKeys(false);
  }

  return (
    <div className="grid gap-6">
      <div className="grid gap-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm font-semibold text-slate-900">Input</div>
          <div className="text-xs text-slate-500">
            Size: {formatBytes(inputBytes)}
            {warnLarge ? " • Large input: formatting may take longer" : ""}
          </div>
        </div>

        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder='Paste JSON here… e.g. {"hello":"world"}'
          rows={10}
          spellCheck={false}
          aria-label="JSON input"
        />

        {warnLarge && !overCap && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Large input detected (&gt; 2 MB). This tool will stay responsive, but formatting may take a moment.
          </div>
        )}

        {overCap && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
            Input exceeds 5 MB cap. Reduce input size to continue.
          </div>
        )}
      </div>

      <div className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <div className="text-sm font-semibold text-slate-900">Options</div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-white p-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Output mode
            </div>
            <div className="mt-2 flex gap-2">
              <Button
                type="button"
                onClick={() => setMode("pretty")}
                className={mode === "pretty" ? "border-blue-500 bg-blue-50" : ""}
              >
                Pretty
              </Button>
              <Button
                type="button"
                onClick={() => setMode("minify")}
                className={mode === "minify" ? "border-blue-500 bg-blue-50" : ""}
              >
                Minify
              </Button>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Formatting
            </div>
            <div className="mt-2">
              <Toggle checked={sortKeys} onChange={setSortKeys} label="Sort keys (deep)" disabled={overCap} />
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={onCopy} disabled={!canCopyDownload}>
            Copy
          </Button>
          <Button type="button" onClick={onDownload} disabled={!canCopyDownload}>
            Download
          </Button>
          <Button type="button" onClick={onReset}>
            Reset
          </Button>
        </div>
      </div>

      <div className="grid gap-2">
        <div className="text-sm font-semibold text-slate-900">Output</div>

        {result.ok ? (
          <div className="text-sm text-emerald-700">{result.info}</div>
        ) : (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
            <div className="font-semibold">Couldn’t parse JSON</div>
            <div className="mt-1">{result.error}</div>
            {"details" in result && (result as any).details ? (
              <pre className="mt-3 overflow-auto rounded-xl border border-rose-200 bg-white p-3 text-xs text-slate-900">
{(result as any).details}
              </pre>
            ) : null}
          </div>
        )}

        <Textarea value={result.ok ? result.output : ""} readOnly rows={10} aria-label="JSON output" />
        <div className="text-xs text-slate-500">Output is plain text only (safe by design).</div>
      </div>
    </div>
  );
}
