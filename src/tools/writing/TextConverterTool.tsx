import { useMemo, useState } from "react";
import { Button } from "../../components/ui/Button";
import { Textarea } from "../../components/ui/Textarea";
import { Toggle } from "../../components/ui/Toggle";
import { downloadTextFile } from "../../lib/download";
import { bytesOfUtf8, formatBytes } from "../../lib/text";
import { useDebouncedValue } from "../../lib/useDebouncedValue";

type CaseMode =
  | "sentence"
  | "lower"
  | "upper"
  | "capitalized"
  | "alternating"
  | "title"
  | "inverse";

type SortMode = "none" | "az" | "za";

const WARN_AT = 2 * 1024 * 1024;
const HARD_CAP = 5 * 1024 * 1024;

function normalizeNewlines(text: string): string {
  return text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

function toSentenceCase(input: string): string {
  const lower = input.toLowerCase();
  return lower.replace(/(^\s*[a-z])|([.!?]\s+[a-z])/g, (m) => m.toUpperCase());
}

function toCapitalizedCase(input: string): string {
  return input.replace(/\b([\p{L}\p{N}])/gu, (m) => m.toUpperCase());
}

function toTitleCase(input: string): string {
  const small = new Set(["a", "an", "and", "or", "the", "to", "of", "in", "for", "on", "with", "at", "by", "from"]);
  const words = input.split(/\s+/);
  return words
    .map((w, idx) => {
      const raw = w;
      const lower = raw.toLowerCase();
      if (idx !== 0 && small.has(lower)) return lower;
      return lower.replace(/^([^\p{L}\p{N}]*)([\p{L}\p{N}])?/u, (m, pfx, ch) =>
        ch ? `${pfx}${String(ch).toUpperCase()}` : m
      );
    })
    .join(" ");
}

function toAlternatingCase(input: string): string {
  let i = 0;
  return input.replace(/[\p{L}\p{N}]/gu, (ch) => {
    const out = i % 2 === 0 ? ch.toLowerCase() : ch.toUpperCase();
    i++;
    return out;
  });
}

function toInverseCase(input: string): string {
  return input.replace(/[\p{L}]/gu, (ch) => {
    const lower = ch.toLowerCase();
    const upper = ch.toUpperCase();
    if (ch === lower) return upper;
    if (ch === upper) return lower;
    return ch;
  });
}

function applyCaseMode(input: string, mode: CaseMode): string {
  switch (mode) {
    case "sentence":
      return toSentenceCase(input);
    case "lower":
      return input.toLowerCase();
    case "upper":
      return input.toUpperCase();
    case "capitalized":
      return toCapitalizedCase(input.toLowerCase());
    case "alternating":
      return toAlternatingCase(input);
    case "title":
      return toTitleCase(input);
    case "inverse":
      return toInverseCase(input);
    default:
      return input;
  }
}

function escapeForCharClass(s: string): string {
  return s.replace(/[-\\\]^]/g, "\\$&");
}

function removeExtraSpaces(text: string): string {
  // Collapse runs of spaces/tabs, keep newlines
  return text.replace(/[ \t]{2,}/g, " ");
}

function trimLines(text: string): string {
  return normalizeNewlines(text)
    .split("\n")
    .map((l) => l.trim())
    .join("\n");
}

function removeBlankLines(text: string): string {
  return normalizeNewlines(text)
    .split("\n")
    .filter((l) => l.trim().length > 0)
    .join("\n");
}

function removeDuplicateLines(text: string, caseInsensitive: boolean): string {
  const lines = normalizeNewlines(text).split("\n");
  const seen = new Set<string>();
  const out: string[] = [];
  for (const l of lines) {
    const key = caseInsensitive ? l.trim().toLowerCase() : l.trim();
    if (!key) {
      out.push(l);
      continue;
    }
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(l);
  }
  return out.join("\n");
}

function sortLines(text: string, mode: SortMode): string {
  if (mode === "none") return text;
  const lines = normalizeNewlines(text).split("\n");
  const sorted = [...lines].sort((a, b) => a.localeCompare(b));
  if (mode === "za") sorted.reverse();
  return sorted.join("\n");
}

function addLineNumbers(text: string): string {
  const lines = normalizeNewlines(text).split("\n");
  const width = String(lines.length).length;
  return lines.map((l, i) => `${String(i + 1).padStart(width, "0")}: ${l}`).join("\n");
}

export function TextConverterTool() {
  const [input, setInput] = useState(
    "hello world! this is a sample.\n\nLine 2 has    extra spaces.\nline 3 has DUPLICATES.\nline 3 has duplicates.\n"
  );

  // Case conversion
  const [caseMode, setCaseMode] = useState<CaseMode>("sentence");

  // Cleanup toggles
  const [normalizeLF, setNormalizeLF] = useState(true);
  const [doTrimLines, setDoTrimLines] = useState(false);
  const [doRemoveExtraSpaces, setDoRemoveExtraSpaces] = useState(true);
  const [doRemoveBlankLines, setDoRemoveBlankLines] = useState(false);

  // Lines ops
  const [dedupeLines, setDedupeLines] = useState(false);
  const [dedupeCaseInsensitive, setDedupeCaseInsensitive] = useState(true);
  const [sortMode, setSortMode] = useState<SortMode>("none");
  const [lineNumbers, setLineNumbers] = useState(false);

  // Remove characters
  const [removeChars, setRemoveChars] = useState("");
  const [removeDigits, setRemoveDigits] = useState(false);
  const [removeLetters, setRemoveLetters] = useState(false);
  const [removeWhitespace, setRemoveWhitespace] = useState(false);

  const inputBytes = useMemo(() => bytesOfUtf8(input), [input]);
  const warnLarge = inputBytes > WARN_AT;
  const overCap = inputBytes > HARD_CAP;

  const debounced = useDebouncedValue(input, 140);

  const output = useMemo(() => {
    if (overCap) return "";

    let out = debounced;

    if (normalizeLF) out = normalizeNewlines(out);

    // Case conversion first (matches user expectation)
    out = applyCaseMode(out, caseMode);

    // Cleanup
    if (doTrimLines) out = trimLines(out);
    if (doRemoveExtraSpaces) out = removeExtraSpaces(out);
    if (doRemoveBlankLines) out = removeBlankLines(out);

    // Remove characters (literal set)
    if (removeChars.trim()) {
      const cls = escapeForCharClass(removeChars);
      const re = new RegExp(`[${cls}]`, "g");
      out = out.replace(re, "");
    }
    if (removeDigits) out = out.replace(/\d+/g, "");
    if (removeLetters) out = out.replace(/[A-Za-z]+/g, "");
    if (removeWhitespace) out = out.replace(/\s+/g, "");

    // Line-based transforms after removals
    if (dedupeLines) out = removeDuplicateLines(out, dedupeCaseInsensitive);
    out = sortLines(out, sortMode);
    if (lineNumbers) out = addLineNumbers(out);

    return out;
  }, [
    debounced,
    overCap,
    normalizeLF,
    caseMode,
    doTrimLines,
    doRemoveExtraSpaces,
    doRemoveBlankLines,
    removeChars,
    removeDigits,
    removeLetters,
    removeWhitespace,
    dedupeLines,
    dedupeCaseInsensitive,
    sortMode,
    lineNumbers
  ]);

  async function copy() {
    await navigator.clipboard.writeText(output);
  }

  function download() {
    downloadTextFile("text-converted.txt", output);
  }

  function clear() {
    setInput("");
  }

  function reset() {
    setInput(
      "hello world! this is a sample.\n\nLine 2 has    extra spaces.\nline 3 has DUPLICATES.\nline 3 has duplicates.\n"
    );
    setCaseMode("sentence");
    setNormalizeLF(true);
    setDoTrimLines(false);
    setDoRemoveExtraSpaces(true);
    setDoRemoveBlankLines(false);
    setDedupeLines(false);
    setDedupeCaseInsensitive(true);
    setSortMode("none");
    setLineNumbers(false);
    setRemoveChars("");
    setRemoveDigits(false);
    setRemoveLetters(false);
    setRemoveWhitespace(false);
  }

  return (
    <div className="grid gap-6">
      {/* Input */}
      <div className="grid gap-2">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm font-semibold text-slate-900">Input</div>
          <div className="text-xs text-slate-500">
            Size: {formatBytes(inputBytes)}
            {warnLarge ? " • Large input" : ""}
          </div>
        </div>

        <Textarea value={input} onChange={(e) => setInput(e.target.value)} rows={10} spellCheck={false} />

        {warnLarge && !overCap && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Large input detected (&gt; 2 MB). Processing may take a moment.
          </div>
        )}

        {overCap && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
            Input exceeds 5 MB cap. Reduce input size to continue.
          </div>
        )}
      </div>

      {/* Case actions */}
      <div className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <div className="text-sm font-semibold text-slate-900">Case conversion</div>

        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={() => setCaseMode("sentence")} className={caseMode === "sentence" ? "border-blue-500 bg-blue-50" : ""}>
            Sentence case
          </Button>
          <Button type="button" onClick={() => setCaseMode("lower")} className={caseMode === "lower" ? "border-blue-500 bg-blue-50" : ""}>
            lower case
          </Button>
          <Button type="button" onClick={() => setCaseMode("upper")} className={caseMode === "upper" ? "border-blue-500 bg-blue-50" : ""}>
            UPPER CASE
          </Button>
          <Button type="button" onClick={() => setCaseMode("capitalized")} className={caseMode === "capitalized" ? "border-blue-500 bg-blue-50" : ""}>
            Capitalized Case
          </Button>
          <Button type="button" onClick={() => setCaseMode("alternating")} className={caseMode === "alternating" ? "border-blue-500 bg-blue-50" : ""}>
            aLtErNaTiNg cAsE
          </Button>
          <Button type="button" onClick={() => setCaseMode("title")} className={caseMode === "title" ? "border-blue-500 bg-blue-50" : ""}>
            Title Case
          </Button>
          <Button type="button" onClick={() => setCaseMode("inverse")} className={caseMode === "inverse" ? "border-blue-500 bg-blue-50" : ""}>
            InVeRsE CaSe
          </Button>
        </div>
      </div>

      {/* Cleanup + remove */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="text-sm font-semibold text-slate-900">Clean up</div>

          <Toggle checked={normalizeLF} onChange={setNormalizeLF} label="Normalize line endings (CRLF → LF)" />
          <Toggle checked={doTrimLines} onChange={setDoTrimLines} label="Trim each line" />
          <Toggle checked={doRemoveExtraSpaces} onChange={setDoRemoveExtraSpaces} label="Remove extra spaces" />
          <Toggle checked={doRemoveBlankLines} onChange={setDoRemoveBlankLines} label="Remove blank lines" />
        </div>

        <div className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="text-sm font-semibold text-slate-900">Remove characters</div>

          <label className="grid gap-1 text-sm text-slate-800">
            <span>Remove these characters (literal set)</span>
            <input
              className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"
              value={removeChars}
              onChange={(e) => setRemoveChars(e.target.value)}
              spellCheck={false}
              placeholder="e.g. ,.!?"
            />
          </label>

          <Toggle checked={removeDigits} onChange={setRemoveDigits} label="Remove digits (0–9)" />
          <Toggle checked={removeLetters} onChange={setRemoveLetters} label="Remove letters (A–Z)" />
          <Toggle checked={removeWhitespace} onChange={setRemoveWhitespace} label="Remove whitespace" />
        </div>
      </div>

      {/* Line operations */}
      <div className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <div className="text-sm font-semibold text-slate-900">Line operations</div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="grid gap-3 rounded-xl border border-slate-200 bg-white p-3">
            <Toggle checked={dedupeLines} onChange={setDedupeLines} label="Remove duplicate lines" />
            <Toggle
              checked={dedupeCaseInsensitive}
              onChange={setDedupeCaseInsensitive}
              label="Case-insensitive duplicates"
              disabled={!dedupeLines}
            />
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-3">
            <label className="grid gap-1 text-sm text-slate-800">
              <span>Sort lines</span>
              <select
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"
                value={sortMode}
                onChange={(e) => setSortMode(e.target.value as SortMode)}
              >
                <option value="none">No sorting</option>
                <option value="az">A → Z</option>
                <option value="za">Z → A</option>
              </select>
            </label>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-3">
            <Toggle checked={lineNumbers} onChange={setLineNumbers} label="Add line numbers" />
          </div>
        </div>
      </div>

      {/* Output + controls */}
      <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm font-semibold text-slate-900">Output</div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={download} disabled={!output || overCap}>
              Download Text
            </Button>
            <Button type="button" onClick={copy} disabled={!output || overCap}>
              Copy to Clipboard
            </Button>
            <Button type="button" onClick={clear}>Clear</Button>
            <Button type="button" onClick={reset}>Reset</Button>
          </div>
        </div>

        <Textarea value={output} readOnly rows={12} />
        <div className="text-xs text-slate-500">Plain text output only.</div>
      </div>
    </div>
  );
}
