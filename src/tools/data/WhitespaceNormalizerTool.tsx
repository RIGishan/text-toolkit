import { useMemo, useState } from "react";

import { useToolContext } from "../../app/toolContext";
import { useToolState } from "../../lib/useToolState";

import { Button } from "../../components/ui/Button";
import { Textarea } from "../../components/ui/Textarea";
import { Toggle } from "../../components/ui/Toggle";

import { downloadTextFile } from "../../lib/download";
import { bytesOfUtf8, formatBytes } from "../../lib/text";
import { useDebouncedValue } from "../../lib/useDebouncedValue";

type LineEnding = "LF" | "CRLF";

const WARN_AT = 2 * 1024 * 1024; // 2 MB
const HARD_CAP = 5 * 1024 * 1024; // 5 MB

function detectLineEnding(text: string): {
  hasCRLF: boolean;
  hasLF: boolean;
  kind: "LF" | "CRLF" | "Mixed" | "None";
} {
  if (!text) return { hasCRLF: false, hasLF: false, kind: "None" };

  const hasCRLF = /\r\n/.test(text);
  // LF that is not part of CRLF: either start-of-string \n or any char except \r before \n
  const hasLoneLF = /(^|[^\r])\n/.test(text);

  const hasLF = hasLoneLF || (!hasCRLF && /\n/.test(text));

  let kind: "LF" | "CRLF" | "Mixed" | "None" = "None";
  if (hasCRLF && hasLF) kind = "Mixed";
  else if (hasCRLF) kind = "CRLF";
  else if (hasLF) kind = "LF";
  else kind = "None";

  return { hasCRLF, hasLF, kind };
}

function normalizeLineEndings(text: string, target: LineEnding): string {
  // First normalize to LF, then map to target
  let out = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  if (target === "CRLF") out = out.replace(/\n/g, "\r\n");
  return out;
}

function ensureFinalNewline(text: string, target: LineEnding): string {
  if (!text) return text;
  const nl = target === "CRLF" ? "\r\n" : "\n";
  if (text.endsWith("\r\n") || text.endsWith("\n")) return text;
  return text + nl;
}

function removeTrailingSpacesPerLine(text: string): string {
  // Operate in LF internally
  const lf = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  return lf
    .split("\n")
    .map((line) => line.replace(/[ \t]+$/g, ""))
    .join("\n");
}

function trimEachLine(text: string): string {
  const lf = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  return lf
    .split("\n")
    .map((line) => line.trim())
    .join("\n");
}

function normalizeInnerSpaces(text: string): string {
  // Collapse runs of spaces/tabs inside lines (does not touch newlines)
  const lf = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  return lf
    .split("\n")
    .map((line) => line.replace(/[ \t]{2,}/g, " ").replace(/\t+/g, " "))
    .join("\n");
}

function collapseBlankLines(text: string, maxBlanks: number): string {
  const lf = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const cap = Math.max(0, Math.min(10, Math.floor(maxBlanks)));

  const out: string[] = [];
  let blankRun = 0;

  for (const line of lf.split("\n")) {
    const isBlank = line.trim().length === 0;
    if (isBlank) {
      blankRun += 1;
      if (blankRun <= cap) out.push("");
    } else {
      blankRun = 0;
      out.push(line);
    }
  }

  return out.join("\n");
}

function sentencePerLine(text: string): string {
  // Very lightweight sentence split:
  // - normalize internal newlines to spaces
  // - split on . ! ? followed by whitespace
  const lf = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const flat = lf.replace(/\n+/g, " ").trim();
  if (!flat) return "";

  const parts = flat
    .split(/(?<=[.!?])\s+/g)
    .map((s) => s.trim())
    .filter(Boolean);

  return parts.join("\n");
}

function countStats(text: string): { lines: number; chars: number; bytes: number } {
  const chars = text.length;
  const bytes = bytesOfUtf8(text);
  const lines =
    text.length === 0
      ? 0
      : text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n").length;
  return { lines, chars, bytes };
}

export function WhitespaceNormalizerTool() {
  const { toolId } = useToolContext();

  const SAMPLE =
    "Hello there.\n" +
    "This is a test! Does it split correctly? Yes it should.\r\n\r\n" +
    "Line 1 with trailing spaces \r\n" +
    " Line 2 has leading spaces\r\n\r\n\r\n" +
    "Line 3\t\t\r\n";

  const [input, setInput] = useState<string>(SAMPLE);

  const DEFAULTS = {
    targetEnding: "LF" as LineEnding,
    removeTrailing: true,
    trimLines: false,
    collapseBlanks: true,
    maxBlankLines: 1,
    sentenceLines: false,
    normalizeSpaces: false,
    finalNewline: false,
  };

  const [opts, setOpts] = useToolState(toolId, DEFAULTS);

  const {
    targetEnding,
    removeTrailing,
    trimLines,
    collapseBlanks,
    maxBlankLines,
    sentenceLines,
    normalizeSpaces,
    finalNewline,
  } = opts;

  const inputBytes = useMemo(() => bytesOfUtf8(input), [input]);
  const warnLarge = inputBytes > WARN_AT;
  const overCap = inputBytes > HARD_CAP;

  const debouncedInput = useDebouncedValue(input, 150);
  const detection = useMemo(() => detectLineEnding(debouncedInput), [debouncedInput]);

  const result = useMemo(() => {
    if (!debouncedInput) {
      return { ok: true as const, output: "", info: "Paste text to normalize." };
    }

    if (overCap) {
      return {
        ok: false as const,
        output: "",
        error: `Input is ${formatBytes(inputBytes)} which exceeds the 5 MB cap. Reduce size to continue.`,
      };
    }

    let out = debouncedInput;

    // Work in LF while transforming
    out = out.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

    // Sentence splitting first (so other line operations apply cleanly)
    if (sentenceLines) out = sentencePerLine(out);

    if (removeTrailing) out = removeTrailingSpacesPerLine(out);
    if (trimLines) out = trimEachLine(out);
    if (normalizeSpaces) out = normalizeInnerSpaces(out);
    if (collapseBlanks) out = collapseBlankLines(out, maxBlankLines);

    // Apply target line endings at the end
    out = normalizeLineEndings(out, targetEnding);

    if (finalNewline) out = ensureFinalNewline(out, targetEnding);

    return { ok: true as const, output: out, info: "Normalized successfully." };
  }, [
    debouncedInput,
    overCap,
    inputBytes,
    removeTrailing,
    trimLines,
    normalizeSpaces,
    collapseBlanks,
    maxBlankLines,
    sentenceLines,
    targetEnding,
    finalNewline,
  ]);

  const inStats = useMemo(() => countStats(input), [input]);
  const outStats = useMemo(() => countStats(result.ok ? result.output : ""), [result]);

  const canCopyDownload = result.ok && result.output.length > 0;

  async function copy() {
    if (!canCopyDownload) return;
    await navigator.clipboard.writeText(result.output);
  }

  function download() {
    if (!canCopyDownload) return;
    downloadTextFile("normalized.txt", result.output);
  }

  function reset() {
    setInput(SAMPLE);
    setOpts(DEFAULTS);
  }

  return (
    <div className="grid gap-4">
      {/* Input */}
      <div className="grid gap-2">
        <div className="flex items-baseline justify-between gap-3">
          <div className="text-sm font-semibold text-slate-900">Input</div>
          <div className="text-xs text-slate-500">
            Size: {formatBytes(inputBytes)}
            {warnLarge ? " • Large input detected" : ""}
          </div>
        </div>

        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          rows={10}
          spellCheck={false}
          placeholder="Paste text here…"
        />

        {warnLarge && !overCap && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Large input detected (&gt; 2 MB). Normalization may take a moment.
          </div>
        )}

        {overCap && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
            Input exceeds 5 MB cap. Reduce input size to continue.
          </div>
        )}

        <div className="rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-700">
          <div className="font-semibold">Detected line endings</div>
          <div className="mt-1">
            <span className="font-mono">{detection.kind}</span>
            {detection.kind !== "None" ? " (based on input sample)" : ""}
          </div>
          <div className="mt-2 text-xs text-slate-500">
            Lines: {inStats.lines} • Characters: {inStats.chars} • Bytes: {formatBytes(inStats.bytes)}
          </div>
        </div>
      </div>

      {/* Options */}
      <div className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <div className="text-sm font-semibold text-slate-900">Options</div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-white p-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Line endings
            </div>
            <div className="mt-2 flex gap-2">
              <Button
                type="button"
                onClick={() => setOpts((p) => ({ ...p, targetEnding: "LF" }))}
                className={targetEnding === "LF" ? "border-blue-500 bg-blue-50" : ""}
              >
                LF (Unix)
              </Button>
              <Button
                type="button"
                onClick={() => setOpts((p) => ({ ...p, targetEnding: "CRLF" }))}
                className={targetEnding === "CRLF" ? "border-blue-500 bg-blue-50" : ""}
              >
                CRLF (Windows)
              </Button>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Paragraph helpers
            </div>
            <div className="mt-2 grid gap-2">
              <Toggle
                checked={sentenceLines}
                onChange={(v) => setOpts((p) => ({ ...p, sentenceLines: v }))}
                label="Sentence per line (split on . ! ?)"
              />
              <Toggle
                checked={normalizeSpaces}
                onChange={(v) => setOpts((p) => ({ ...p, normalizeSpaces: v }))}
                label="Normalize inner spaces (collapse multiple spaces/tabs)"
              />
              <Toggle
                checked={finalNewline}
                onChange={(v) => setOpts((p) => ({ ...p, finalNewline: v }))}
                label="Ensure final newline at end of output"
              />
            </div>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-white p-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Whitespace cleanup
            </div>
            <div className="mt-2 grid gap-2">
              <Toggle
                checked={removeTrailing}
                onChange={(v) => setOpts((p) => ({ ...p, removeTrailing: v }))}
                label="Remove trailing spaces (per line)"
              />
              <Toggle
                checked={trimLines}
                onChange={(v) => setOpts((p) => ({ ...p, trimLines: v }))}
                label="Trim each line (leading + trailing)"
              />
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Blank lines
            </div>
            <div className="mt-2 grid gap-2">
              <Toggle
                checked={collapseBlanks}
                onChange={(v) => setOpts((p) => ({ ...p, collapseBlanks: v }))}
                label="Collapse blank lines"
              />
              {collapseBlanks && (
                <label className="grid gap-1 text-sm text-slate-800">
                  <span>Max consecutive blank lines (0–10)</span>
                  <input
                    className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm"
                    type="number"
                    min={0}
                    max={10}
                    value={maxBlankLines}
                    onChange={(e) =>
                      setOpts((p) => ({
                        ...p,
                        maxBlankLines: Number(e.target.value),
                      }))
                    }
                  />
                </label>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={copy} disabled={!canCopyDownload}>
            Copy
          </Button>
          <Button type="button" onClick={download} disabled={!canCopyDownload}>
            Download
          </Button>
          <Button type="button" onClick={reset}>
            Reset
          </Button>
        </div>
      </div>

      {/* Output */}
      <div className="grid gap-2">
        <div className="text-sm font-semibold text-slate-900">Output</div>

        {result.ok ? (
          <div className="text-sm text-emerald-700">{result.info}</div>
        ) : (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
            <div className="font-semibold">Couldn’t process</div>
            <div className="mt-1">{result.error}</div>
          </div>
        )}

        <Textarea value={result.ok ? result.output : ""} readOnly rows={12} />

        <div className="text-xs text-slate-500">
          Output stats — Lines: {outStats.lines} • Characters: {outStats.chars} • Bytes:{" "}
          {formatBytes(outStats.bytes)}
        </div>
      </div>
    </div>
  );
}
