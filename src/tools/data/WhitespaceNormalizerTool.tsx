import { useMemo, useState } from "react";
import { Button } from "../../components/ui/Button";
import { Textarea } from "../../components/ui/Textarea";
import { Toggle } from "../../components/ui/Toggle";
import { downloadTextFile } from "../../lib/download";
import { bytesOfUtf8, formatBytes } from "../../lib/text";
import { useDebouncedValue } from "../../lib/useDebouncedValue";

type LineEnding = "LF" | "CRLF";

const WARN_AT = 2 * 1024 * 1024;
const HARD_CAP = 5 * 1024 * 1024;

function detectLineEnding(text: string): {
  hasCRLF: boolean;
  hasLF: boolean;
  kind: "LF" | "CRLF" | "Mixed" | "None";
} {
  const hasCRLF = /\r\n/.test(text);
  // Detect lone LF that isn't part of CRLF
  const hasLF = /(?<!\r)\n/.test(text);
  if (hasCRLF && hasLF) return { hasCRLF, hasLF, kind: "Mixed" };
  if (hasCRLF) return { hasCRLF, hasLF, kind: "CRLF" };
  if (hasLF) return { hasCRLF, hasLF, kind: "LF" };
  return { hasCRLF, hasLF, kind: "None" };
}

function normalizeLineEndings(text: string, target: LineEnding): string {
  // First normalize everything to LF
  let t = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  if (target === "CRLF") t = t.replace(/\n/g, "\r\n");
  return t;
}

function removeTrailingSpacesPerLine(text: string): string {
  // Remove spaces/tabs at end of each line
  return text.replace(/[ \t]+$/gm, "");
}

function trimEachLine(text: string): string {
  return text.replace(/^[ \t]+|[ \t]+$/gm, "");
}

function collapseBlankLines(text: string, maxBlankLines: number): string {
  // maxBlankLines = number of consecutive blank lines allowed
  // Example: 1 means at most 1 blank line between blocks.
  const n = Math.max(0, Math.min(10, Math.floor(maxBlankLines)));
  if (n === 0) {
    // remove all blank lines
    return text.replace(/^\s*[\r\n]+/gm, "").replace(/[\r\n]{2,}/g, "\n");
  }

  // Normalize to LF temporarily for easier handling
  const lf = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  // Replace runs of blank lines with limited count
  const re = new RegExp(`(?:\\n[\\t ]*){${n + 1},}\\n`, "g");
  const limited = lf.replace(re, "\n" + "\n".repeat(n));
  return limited;
}

// NEW: extra features
function normalizeInnerSpaces(text: string): string {
  // Collapse runs of spaces/tabs into a single space
  return text.replace(/[ \t]{2,}/g, " ");
}

function ensureFinalNewline(text: string, target: LineEnding): string {
  if (!text) return text;
  const nl = target === "CRLF" ? "\r\n" : "\n";
  return text.endsWith(nl) ? text : text + nl;
}

function sentencePerLine(text: string): string {
  // Normalize to LF for splitting logic
  const lf = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  // Split when . ! ? is followed by whitespace/newline.
  // Note: Not perfect for abbreviations (e.g., "Mr.", "e.g.") but works well for most paragraphs.
  const parts = lf
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
  const [input, setInput] = useState<string>(
    "Hello there. This is a test! Does it split correctly? Yes it should.\r\n\r\nLine 1 with trailing spaces    \r\n  Line 2 has leading spaces\r\n\r\n\r\nLine 3\t\t\r\n"
  );

  const [targetEnding, setTargetEnding] = useState<LineEnding>("LF");
  const [removeTrailing, setRemoveTrailing] = useState(true);
  const [trimLines, setTrimLines] = useState(false);
  const [collapseBlanks, setCollapseBlanks] = useState(true);
  const [maxBlankLines, setMaxBlankLines] = useState(1);

  // NEW toggles
  const [sentenceLines, setSentenceLines] = useState(false);
  const [normalizeSpaces, setNormalizeSpaces] = useState(false);
  const [finalNewline, setFinalNewline] = useState(false);

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
        error: `Input is ${formatBytes(inputBytes)} which exceeds the 5 MB cap. Reduce size to continue.`
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
    finalNewline
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
    setInput(
      "Hello there. This is a test! Does it split correctly? Yes it should.\r\n\r\nLine 1 with trailing spaces    \r\n  Line 2 has leading spaces\r\n\r\n\r\nLine 3\t\t\r\n"
    );
    setTargetEnding("LF");
    setRemoveTrailing(true);
    setTrimLines(false);
    setNormalizeSpaces(false);
    setCollapseBlanks(true);
    setMaxBlankLines(1);
    setSentenceLines(false);
    setFinalNewline(false);
  }

  return (
    <div className="grid gap-6">
      {/* Input */}
      <div className="grid gap-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
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
                onClick={() => setTargetEnding("LF")}
                className={targetEnding === "LF" ? "border-blue-500 bg-blue-50" : ""}
              >
                LF (Unix)
              </Button>
              <Button
                type="button"
                onClick={() => setTargetEnding("CRLF")}
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
                onChange={setSentenceLines}
                label="Sentence per line (split on . ! ?)"
              />
              <Toggle
                checked={normalizeSpaces}
                onChange={setNormalizeSpaces}
                label="Normalize inner spaces (collapse multiple spaces/tabs)"
              />
              <Toggle
                checked={finalNewline}
                onChange={setFinalNewline}
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
                onChange={setRemoveTrailing}
                label="Remove trailing spaces (per line)"
              />
              <Toggle
                checked={trimLines}
                onChange={setTrimLines}
                label="Trim each line (leading + trailing)"
              />
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Blank lines
            </div>
            <div className="mt-2 grid gap-2">
              <Toggle checked={collapseBlanks} onChange={setCollapseBlanks} label="Collapse blank lines" />
              {collapseBlanks && (
                <label className="grid gap-1 text-sm text-slate-800">
                  <span>Max consecutive blank lines (0–10)</span>
                  <input
                    className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm"
                    type="number"
                    min={0}
                    max={10}
                    value={maxBlankLines}
                    onChange={(e) => setMaxBlankLines(Number(e.target.value))}
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
          Output stats — Lines: {outStats.lines} • Characters: {outStats.chars} • Bytes: {formatBytes(outStats.bytes)}
        </div>
      </div>
    </div>
  );
}
