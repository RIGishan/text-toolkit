<<<<<<< HEAD
import { useMemo, useState } from "react";
import { Button } from "../../components/ui/Button";
import { Textarea } from "../../components/ui/Textarea";
import { Toggle } from "../../components/ui/Toggle";
import { downloadTextFile } from "../../lib/download";
import { bytesOfUtf8, formatBytes } from "../../lib/text";
import { useDebouncedValue } from "../../lib/useDebouncedValue";

type SortMode = "none" | "az" | "za";
type ReverseMode = "none" | "chars" | "words" | "lines";
type KeepOnlyMode = "none" | "digits" | "letters";

const WARN_AT = 2 * 1024 * 1024;
const HARD_CAP = 5 * 1024 * 1024;

function normalizeNewlines(text: string): string {
  return text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

function splitLines(text: string): string[] {
  return normalizeNewlines(text).split("\n");
}

function joinLines(lines: string[]): string {
  return lines.join("\n");
}

function removeDuplicateLines(text: string, caseInsensitive: boolean): string {
  const lines = splitLines(text);
  const seen = new Set<string>();
  const out: string[] = [];

  for (const line of lines) {
    const t = line.trim();
    if (!t) {
      out.push(line);
      continue;
    }
    const key = caseInsensitive ? t.toLowerCase() : t;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(line);
  }
  return joinLines(out);
}

function sortLines(text: string, mode: SortMode): string {
  if (mode === "none") return text;
  const lines = splitLines(text);
  const sorted = [...lines].sort((a, b) => a.localeCompare(b));
  if (mode === "za") sorted.reverse();
  return joinLines(sorted);
}

function addLineNumbers(text: string, startAt: number): string {
  const lines = splitLines(text);
  const width = String(startAt + lines.length - 1).length;
  return lines.map((l, i) => `${String(startAt + i).padStart(width, "0")}: ${l}`).join("\n");
}

function removeHtmlTags(text: string): string {
  const stripped = text.replace(/<[^>]*>/g, "");
  return stripped
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
}

function reverseChars(text: string): string {
  return Array.from(text).reverse().join("");
}

function reverseWords(text: string): string {
  const tokens = text.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return text;
  return tokens.reverse().join(" ");
}

function reverseLines(text: string): string {
  const lines = splitLines(text);
  return joinLines(lines.reverse());
}

function findReplaceLiteral(text: string, find: string, replaceWith: string, caseInsensitive: boolean): string {
  if (!find) return text;
  const escaped = find.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const flags = caseInsensitive ? "gi" : "g";
  const re = new RegExp(escaped, flags);
  return text.replace(re, replaceWith);
}

function removeExtraSpaces(text: string): string {
  return text.replace(/[ \t]{2,}/g, " ");
}

function trimLines(text: string): string {
  return splitLines(text).map((l) => l.trim()).join("\n");
}

function removeBlankLines(text: string): string {
  return splitLines(text).filter((l) => l.trim().length > 0).join("\n");
}

function removePunctuation(text: string): string {
  // Remove most common punctuation while keeping letters/numbers/whitespace.
  // Keeps underscore by default; adjust if you want.
  return text.replace(/[!"#$%&'()*+,\-./:;<=>?@[\\\]^`{|}~]/g, "");
}

function keepOnly(text: string, mode: KeepOnlyMode): string {
  if (mode === "none") return text;
  if (mode === "digits") return text.replace(/[^\d\n\r\t ]+/g, "");
  // letters only (ASCII letters). If you want full Unicode letters, we can upgrade using \p{L} with /u.
  return text.replace(/[^A-Za-z\n\r\t ]+/g, "");
}

function prefixSuffixEachLine(text: string, prefix: string, suffix: string, skipEmpty: boolean): string {
  const lines = splitLines(text);
  const out = lines.map((l) => {
    if (skipEmpty && l.trim().length === 0) return l;
    return `${prefix}${l}${suffix}`;
  });
  return joinLines(out);
}

function extractLinesContaining(text: string, needle: string, caseInsensitive: boolean, invert: boolean): string {
  const n = (needle ?? "").trim();
  if (!n) return text;

  const target = caseInsensitive ? n.toLowerCase() : n;
  const lines = splitLines(text);

  const out = lines.filter((l) => {
    const hay = caseInsensitive ? l.toLowerCase() : l;
    const has = hay.includes(target);
    return invert ? !has : has;
  });

  return joinLines(out);
}

export function TextUtilitiesTool() {
  const [input, setInput] = useState(
    `  <h1>Hello World!</h1>
Line A
Line B!!!
Line B!!!
Line C?

Find me and replace me.
Email: hello@example.com
Order ID: 123-456-789
`
  );

  // Reverse
  const [reverseMode, setReverseMode] = useState<ReverseMode>("none");

  // Line ops
  const [dedupeLines, setDedupeLines] = useState(false);
  const [dedupeCaseInsensitive, setDedupeCaseInsensitive] = useState(true);
  const [sortMode, setSortMode] = useState<SortMode>("none");
  const [lineNumbers, setLineNumbers] = useState(false);
  const [lineNumberStart, setLineNumberStart] = useState(1);

  // Cleanup
  const [normalizeLF, setNormalizeLF] = useState(true);
  const [doTrimLines, setDoTrimLines] = useState(false);
  const [doRemoveExtraSpaces, setDoRemoveExtraSpaces] = useState(true);
  const [doRemoveBlankLines, setDoRemoveBlankLines] = useState(false);

  // HTML removal
  const [stripHtmlTags, setStripHtmlTags] = useState(false);

  // Find/replace (literal)
  const [findText, setFindText] = useState("replace me");
  const [replaceText, setReplaceText] = useState("replaced ✅");
  const [findCaseInsensitive, setFindCaseInsensitive] = useState(true);

  // New: punctuation + keep-only
  const [doRemovePunctuation, setDoRemovePunctuation] = useState(false);
  const [keepOnlyMode, setKeepOnlyMode] = useState<KeepOnlyMode>("none");

  // New: prefix/suffix
  const [prefix, setPrefix] = useState("");
  const [suffix, setSuffix] = useState("");
  const [skipEmptyLinesForAffixes, setSkipEmptyLinesForAffixes] = useState(true);

  // New: extract lines containing
  const [extractNeedle, setExtractNeedle] = useState("");
  const [extractCaseInsensitive, setExtractCaseInsensitive] = useState(true);
  const [extractInvert, setExtractInvert] = useState(false);

  const inputBytes = useMemo(() => bytesOfUtf8(input), [input]);
  const warnLarge = inputBytes > WARN_AT;
  const overCap = inputBytes > HARD_CAP;

  const debounced = useDebouncedValue(input, 160);

  const output = useMemo(() => {
    if (overCap) return "";

    let out = debounced;

    if (normalizeLF) out = normalizeNewlines(out);

    // Optional HTML tag removal early
    if (stripHtmlTags) out = removeHtmlTags(out);

    // Find/replace (literal)
    out = findReplaceLiteral(out, findText, replaceText, findCaseInsensitive);

    // Extraction (do before sorting/dedupe so user can isolate content)
    out = extractLinesContaining(out, extractNeedle, extractCaseInsensitive, extractInvert);

    // Cleanup
    if (doTrimLines) out = trimLines(out);
    if (doRemoveExtraSpaces) out = removeExtraSpaces(out);
    if (doRemoveBlankLines) out = removeBlankLines(out);

    // Remove punctuation
    if (doRemovePunctuation) out = removePunctuation(out);

    // Keep only digits/letters (after punctuation removal)
    out = keepOnly(out, keepOnlyMode);

    // Prefix/suffix each line
    if (prefix || suffix) {
      out = prefixSuffixEachLine(out, prefix, suffix, skipEmptyLinesForAffixes);
    }

    // Line operations
    if (dedupeLines) out = removeDuplicateLines(out, dedupeCaseInsensitive);
    out = sortLines(out, sortMode);
    if (lineNumbers) out = addLineNumbers(out, Math.max(1, Math.floor(lineNumberStart || 1)));

    // Reverse last
    if (reverseMode === "chars") out = reverseChars(out);
    else if (reverseMode === "words") out = reverseWords(out);
    else if (reverseMode === "lines") out = reverseLines(out);

    return out;
  }, [
    debounced,
    overCap,
    normalizeLF,
    stripHtmlTags,
    findText,
    replaceText,
    findCaseInsensitive,
    extractNeedle,
    extractCaseInsensitive,
    extractInvert,
    doTrimLines,
    doRemoveExtraSpaces,
    doRemoveBlankLines,
    doRemovePunctuation,
    keepOnlyMode,
    prefix,
    suffix,
    skipEmptyLinesForAffixes,
    dedupeLines,
    dedupeCaseInsensitive,
    sortMode,
    lineNumbers,
    lineNumberStart,
    reverseMode
  ]);

  async function copy() {
    await navigator.clipboard.writeText(output);
  }

  function download() {
    downloadTextFile("text-utilities-output.txt", output);
  }

  function clear() {
    setInput("");
  }

  function reset() {
    setInput(
      `  <h1>Hello World!</h1>
Line A
Line B!!!
Line B!!!
Line C?

Find me and replace me.
Email: hello@example.com
Order ID: 123-456-789
`
    );

    setReverseMode("none");

    setDedupeLines(false);
    setDedupeCaseInsensitive(true);
    setSortMode("none");
    setLineNumbers(false);
    setLineNumberStart(1);

    setNormalizeLF(true);
    setDoTrimLines(false);
    setDoRemoveExtraSpaces(true);
    setDoRemoveBlankLines(false);

    setStripHtmlTags(false);

    setFindText("replace me");
    setReplaceText("replaced ✅");
    setFindCaseInsensitive(true);

    setDoRemovePunctuation(false);
    setKeepOnlyMode("none");

    setPrefix("");
    setSuffix("");
    setSkipEmptyLinesForAffixes(true);

    setExtractNeedle("");
    setExtractCaseInsensitive(true);
    setExtractInvert(false);
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

      {/* Controls */}
      <div className="grid gap-4 sm:grid-cols-2">
        {/* Cleanup */}
        <div className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="text-sm font-semibold text-slate-900">Cleanup</div>
          <Toggle checked={normalizeLF} onChange={setNormalizeLF} label="Normalize line endings (CRLF → LF)" />
          <Toggle checked={doTrimLines} onChange={setDoTrimLines} label="Trim each line" />
          <Toggle checked={doRemoveExtraSpaces} onChange={setDoRemoveExtraSpaces} label="Remove extra spaces" />
          <Toggle checked={doRemoveBlankLines} onChange={setDoRemoveBlankLines} label="Remove blank lines" />
          <Toggle checked={stripHtmlTags} onChange={setStripHtmlTags} label="Remove HTML tags (best-effort)" />
          <Toggle checked={doRemovePunctuation} onChange={setDoRemovePunctuation} label="Remove punctuation" />

          <label className="grid gap-1 text-sm text-slate-800">
            <span>Keep only</span>
            <select
              className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"
              value={keepOnlyMode}
              onChange={(e) => setKeepOnlyMode(e.target.value as KeepOnlyMode)}
            >
              <option value="none">Keep everything</option>
              <option value="digits">Digits only (keep whitespace/newlines)</option>
              <option value="letters">Letters only (keep whitespace/newlines)</option>
            </select>
          </label>

          <div className="text-xs text-slate-500">
            “Keep only” removes everything else except whitespace/newlines for readability.
          </div>
        </div>

        {/* Find/replace + Extract */}
        <div className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="text-sm font-semibold text-slate-900">Find/Replace + Extract</div>

          <div className="grid gap-2">
            <label className="grid gap-1 text-sm text-slate-800">
              <span>Find (literal)</span>
              <input
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"
                value={findText}
                onChange={(e) => setFindText(e.target.value)}
                spellCheck={false}
              />
            </label>

            <label className="grid gap-1 text-sm text-slate-800">
              <span>Replace with</span>
              <input
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"
                value={replaceText}
                onChange={(e) => setReplaceText(e.target.value)}
                spellCheck={false}
              />
            </label>

            <Toggle checked={findCaseInsensitive} onChange={setFindCaseInsensitive} label="Find: case-insensitive" />
          </div>

          <div className="h-px bg-slate-200" />

          <label className="grid gap-1 text-sm text-slate-800">
            <span>Extract lines containing (literal)</span>
            <input
              className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"
              value={extractNeedle}
              onChange={(e) => setExtractNeedle(e.target.value)}
              spellCheck={false}
              placeholder="e.g. error, @gmail.com, Order ID"
            />
          </label>

          <div className="grid gap-2 sm:grid-cols-2">
            <Toggle checked={extractCaseInsensitive} onChange={setExtractCaseInsensitive} label="Extract: case-insensitive" />
            <Toggle checked={extractInvert} onChange={setExtractInvert} label="Invert (exclude matching lines)" />
          </div>

          <div className="text-xs text-slate-500">No regex here (safe + beginner-friendly).</div>
        </div>
      </div>

      {/* Prefix/Suffix + Line ops + Reverse */}
      <div className="grid gap-4 sm:grid-cols-3">
        {/* Prefix/Suffix */}
        <div className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="text-sm font-semibold text-slate-900">Prefix / Suffix each line</div>

          <label className="grid gap-1 text-sm text-slate-800">
            <span>Prefix</span>
            <input
              className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"
              value={prefix}
              onChange={(e) => setPrefix(e.target.value)}
              spellCheck={false}
              placeholder="e.g. - "
            />
          </label>

          <label className="grid gap-1 text-sm text-slate-800">
            <span>Suffix</span>
            <input
              className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"
              value={suffix}
              onChange={(e) => setSuffix(e.target.value)}
              spellCheck={false}
              placeholder="e.g. ;"
            />
          </label>

          <Toggle
            checked={skipEmptyLinesForAffixes}
            onChange={setSkipEmptyLinesForAffixes}
            label="Skip empty lines"
          />

          <div className="text-xs text-slate-500">
            Helpful for bullet lists, SQL lists, CSV quoting, etc.
          </div>
        </div>

        {/* Line ops */}
        <div className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="text-sm font-semibold text-slate-900">Line operations</div>

          <Toggle checked={dedupeLines} onChange={setDedupeLines} label="Remove duplicate lines" />
          <Toggle
            checked={dedupeCaseInsensitive}
            onChange={setDedupeCaseInsensitive}
            label="Case-insensitive duplicates"
            disabled={!dedupeLines}
          />

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

          <Toggle checked={lineNumbers} onChange={setLineNumbers} label="Add line numbers" />
          <label className="grid gap-1 text-sm text-slate-800">
            <span>Line number start</span>
            <input
              className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"
              type="number"
              min={1}
              value={lineNumberStart}
              onChange={(e) => setLineNumberStart(Number(e.target.value))}
              disabled={!lineNumbers}
            />
          </label>
        </div>

        {/* Reverse */}
        <div className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="text-sm font-semibold text-slate-900">Reverse</div>

          <div className="grid gap-2">
            <Button type="button" onClick={() => setReverseMode("none")} className={reverseMode === "none" ? "border-blue-500 bg-blue-50" : ""}>
              No reverse
            </Button>
            <Button type="button" onClick={() => setReverseMode("chars")} className={reverseMode === "chars" ? "border-blue-500 bg-blue-50" : ""}>
              Reverse characters
            </Button>
            <Button type="button" onClick={() => setReverseMode("words")} className={reverseMode === "words" ? "border-blue-500 bg-blue-50" : ""}>
              Reverse word order
            </Button>
            <Button type="button" onClick={() => setReverseMode("lines")} className={reverseMode === "lines" ? "border-blue-500 bg-blue-50" : ""}>
              Reverse line order
            </Button>
          </div>

          <div className="text-xs text-slate-500">
            Output is plain text. (Emoji sequences may not reverse perfectly.)
          </div>
        </div>
      </div>

      {/* Output */}
      <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm font-semibold text-slate-900">Output</div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={download} disabled={!output || overCap}>Download</Button>
            <Button type="button" onClick={copy} disabled={!output || overCap}>Copy</Button>
            <Button type="button" onClick={clear}>Clear</Button>
            <Button type="button" onClick={reset}>Reset</Button>
          </div>
        </div>

        <Textarea value={output} readOnly rows={12} />
        <div className="text-xs text-slate-500">Plain text output only (safe by design).</div>
      </div>
    </div>
  );
}
=======
import { useMemo, useState } from "react";
import { Button } from "../../components/ui/Button";
import { Textarea } from "../../components/ui/Textarea";
import { Toggle } from "../../components/ui/Toggle";
import { downloadTextFile } from "../../lib/download";
import { bytesOfUtf8, formatBytes } from "../../lib/text";
import { useDebouncedValue } from "../../lib/useDebouncedValue";

type SortMode = "none" | "az" | "za";
type ReverseMode = "none" | "chars" | "words" | "lines";
type KeepOnlyMode = "none" | "digits" | "letters";

const WARN_AT = 2 * 1024 * 1024;
const HARD_CAP = 5 * 1024 * 1024;

function normalizeNewlines(text: string): string {
  return text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

function splitLines(text: string): string[] {
  return normalizeNewlines(text).split("\n");
}

function joinLines(lines: string[]): string {
  return lines.join("\n");
}

function removeDuplicateLines(text: string, caseInsensitive: boolean): string {
  const lines = splitLines(text);
  const seen = new Set<string>();
  const out: string[] = [];

  for (const line of lines) {
    const t = line.trim();
    if (!t) {
      out.push(line);
      continue;
    }
    const key = caseInsensitive ? t.toLowerCase() : t;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(line);
  }
  return joinLines(out);
}

function sortLines(text: string, mode: SortMode): string {
  if (mode === "none") return text;
  const lines = splitLines(text);
  const sorted = [...lines].sort((a, b) => a.localeCompare(b));
  if (mode === "za") sorted.reverse();
  return joinLines(sorted);
}

function addLineNumbers(text: string, startAt: number): string {
  const lines = splitLines(text);
  const width = String(startAt + lines.length - 1).length;
  return lines.map((l, i) => `${String(startAt + i).padStart(width, "0")}: ${l}`).join("\n");
}

function removeHtmlTags(text: string): string {
  const stripped = text.replace(/<[^>]*>/g, "");
  return stripped
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
}

function reverseChars(text: string): string {
  return Array.from(text).reverse().join("");
}

function reverseWords(text: string): string {
  const tokens = text.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return text;
  return tokens.reverse().join(" ");
}

function reverseLines(text: string): string {
  const lines = splitLines(text);
  return joinLines(lines.reverse());
}

function findReplaceLiteral(text: string, find: string, replaceWith: string, caseInsensitive: boolean): string {
  if (!find) return text;
  const escaped = find.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const flags = caseInsensitive ? "gi" : "g";
  const re = new RegExp(escaped, flags);
  return text.replace(re, replaceWith);
}

function removeExtraSpaces(text: string): string {
  return text.replace(/[ \t]{2,}/g, " ");
}

function trimLines(text: string): string {
  return splitLines(text).map((l) => l.trim()).join("\n");
}

function removeBlankLines(text: string): string {
  return splitLines(text).filter((l) => l.trim().length > 0).join("\n");
}

function removePunctuation(text: string): string {
  // Remove most common punctuation while keeping letters/numbers/whitespace.
  // Keeps underscore by default; adjust if you want.
  return text.replace(/[!"#$%&'()*+,\-./:;<=>?@[\\\]^`{|}~]/g, "");
}

function keepOnly(text: string, mode: KeepOnlyMode): string {
  if (mode === "none") return text;
  if (mode === "digits") return text.replace(/[^\d\n\r\t ]+/g, "");
  // letters only (ASCII letters). If you want full Unicode letters, we can upgrade using \p{L} with /u.
  return text.replace(/[^A-Za-z\n\r\t ]+/g, "");
}

function prefixSuffixEachLine(text: string, prefix: string, suffix: string, skipEmpty: boolean): string {
  const lines = splitLines(text);
  const out = lines.map((l) => {
    if (skipEmpty && l.trim().length === 0) return l;
    return `${prefix}${l}${suffix}`;
  });
  return joinLines(out);
}

function extractLinesContaining(text: string, needle: string, caseInsensitive: boolean, invert: boolean): string {
  const n = (needle ?? "").trim();
  if (!n) return text;

  const target = caseInsensitive ? n.toLowerCase() : n;
  const lines = splitLines(text);

  const out = lines.filter((l) => {
    const hay = caseInsensitive ? l.toLowerCase() : l;
    const has = hay.includes(target);
    return invert ? !has : has;
  });

  return joinLines(out);
}

export function TextUtilitiesTool() {
  const [input, setInput] = useState(
    `  <h1>Hello World!</h1>
Line A
Line B!!!
Line B!!!
Line C?

Find me and replace me.
Email: hello@example.com
Order ID: 123-456-789
`
  );

  // Reverse
  const [reverseMode, setReverseMode] = useState<ReverseMode>("none");

  // Line ops
  const [dedupeLines, setDedupeLines] = useState(false);
  const [dedupeCaseInsensitive, setDedupeCaseInsensitive] = useState(true);
  const [sortMode, setSortMode] = useState<SortMode>("none");
  const [lineNumbers, setLineNumbers] = useState(false);
  const [lineNumberStart, setLineNumberStart] = useState(1);

  // Cleanup
  const [normalizeLF, setNormalizeLF] = useState(true);
  const [doTrimLines, setDoTrimLines] = useState(false);
  const [doRemoveExtraSpaces, setDoRemoveExtraSpaces] = useState(true);
  const [doRemoveBlankLines, setDoRemoveBlankLines] = useState(false);

  // HTML removal
  const [stripHtmlTags, setStripHtmlTags] = useState(false);

  // Find/replace (literal)
  const [findText, setFindText] = useState("replace me");
  const [replaceText, setReplaceText] = useState("replaced ✅");
  const [findCaseInsensitive, setFindCaseInsensitive] = useState(true);

  // New: punctuation + keep-only
  const [doRemovePunctuation, setDoRemovePunctuation] = useState(false);
  const [keepOnlyMode, setKeepOnlyMode] = useState<KeepOnlyMode>("none");

  // New: prefix/suffix
  const [prefix, setPrefix] = useState("");
  const [suffix, setSuffix] = useState("");
  const [skipEmptyLinesForAffixes, setSkipEmptyLinesForAffixes] = useState(true);

  // New: extract lines containing
  const [extractNeedle, setExtractNeedle] = useState("");
  const [extractCaseInsensitive, setExtractCaseInsensitive] = useState(true);
  const [extractInvert, setExtractInvert] = useState(false);

  const inputBytes = useMemo(() => bytesOfUtf8(input), [input]);
  const warnLarge = inputBytes > WARN_AT;
  const overCap = inputBytes > HARD_CAP;

  const debounced = useDebouncedValue(input, 160);

  const output = useMemo(() => {
    if (overCap) return "";

    let out = debounced;

    if (normalizeLF) out = normalizeNewlines(out);

    // Optional HTML tag removal early
    if (stripHtmlTags) out = removeHtmlTags(out);

    // Find/replace (literal)
    out = findReplaceLiteral(out, findText, replaceText, findCaseInsensitive);

    // Extraction (do before sorting/dedupe so user can isolate content)
    out = extractLinesContaining(out, extractNeedle, extractCaseInsensitive, extractInvert);

    // Cleanup
    if (doTrimLines) out = trimLines(out);
    if (doRemoveExtraSpaces) out = removeExtraSpaces(out);
    if (doRemoveBlankLines) out = removeBlankLines(out);

    // Remove punctuation
    if (doRemovePunctuation) out = removePunctuation(out);

    // Keep only digits/letters (after punctuation removal)
    out = keepOnly(out, keepOnlyMode);

    // Prefix/suffix each line
    if (prefix || suffix) {
      out = prefixSuffixEachLine(out, prefix, suffix, skipEmptyLinesForAffixes);
    }

    // Line operations
    if (dedupeLines) out = removeDuplicateLines(out, dedupeCaseInsensitive);
    out = sortLines(out, sortMode);
    if (lineNumbers) out = addLineNumbers(out, Math.max(1, Math.floor(lineNumberStart || 1)));

    // Reverse last
    if (reverseMode === "chars") out = reverseChars(out);
    else if (reverseMode === "words") out = reverseWords(out);
    else if (reverseMode === "lines") out = reverseLines(out);

    return out;
  }, [
    debounced,
    overCap,
    normalizeLF,
    stripHtmlTags,
    findText,
    replaceText,
    findCaseInsensitive,
    extractNeedle,
    extractCaseInsensitive,
    extractInvert,
    doTrimLines,
    doRemoveExtraSpaces,
    doRemoveBlankLines,
    doRemovePunctuation,
    keepOnlyMode,
    prefix,
    suffix,
    skipEmptyLinesForAffixes,
    dedupeLines,
    dedupeCaseInsensitive,
    sortMode,
    lineNumbers,
    lineNumberStart,
    reverseMode
  ]);

  async function copy() {
    await navigator.clipboard.writeText(output);
  }

  function download() {
    downloadTextFile("text-utilities-output.txt", output);
  }

  function clear() {
    setInput("");
  }

  function reset() {
    setInput(
      `  <h1>Hello World!</h1>
Line A
Line B!!!
Line B!!!
Line C?

Find me and replace me.
Email: hello@example.com
Order ID: 123-456-789
`
    );

    setReverseMode("none");

    setDedupeLines(false);
    setDedupeCaseInsensitive(true);
    setSortMode("none");
    setLineNumbers(false);
    setLineNumberStart(1);

    setNormalizeLF(true);
    setDoTrimLines(false);
    setDoRemoveExtraSpaces(true);
    setDoRemoveBlankLines(false);

    setStripHtmlTags(false);

    setFindText("replace me");
    setReplaceText("replaced ✅");
    setFindCaseInsensitive(true);

    setDoRemovePunctuation(false);
    setKeepOnlyMode("none");

    setPrefix("");
    setSuffix("");
    setSkipEmptyLinesForAffixes(true);

    setExtractNeedle("");
    setExtractCaseInsensitive(true);
    setExtractInvert(false);
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

      {/* Controls */}
      <div className="grid gap-4 sm:grid-cols-2">
        {/* Cleanup */}
        <div className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="text-sm font-semibold text-slate-900">Cleanup</div>
          <Toggle checked={normalizeLF} onChange={setNormalizeLF} label="Normalize line endings (CRLF → LF)" />
          <Toggle checked={doTrimLines} onChange={setDoTrimLines} label="Trim each line" />
          <Toggle checked={doRemoveExtraSpaces} onChange={setDoRemoveExtraSpaces} label="Remove extra spaces" />
          <Toggle checked={doRemoveBlankLines} onChange={setDoRemoveBlankLines} label="Remove blank lines" />
          <Toggle checked={stripHtmlTags} onChange={setStripHtmlTags} label="Remove HTML tags (best-effort)" />
          <Toggle checked={doRemovePunctuation} onChange={setDoRemovePunctuation} label="Remove punctuation" />

          <label className="grid gap-1 text-sm text-slate-800">
            <span>Keep only</span>
            <select
              className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"
              value={keepOnlyMode}
              onChange={(e) => setKeepOnlyMode(e.target.value as KeepOnlyMode)}
            >
              <option value="none">Keep everything</option>
              <option value="digits">Digits only (keep whitespace/newlines)</option>
              <option value="letters">Letters only (keep whitespace/newlines)</option>
            </select>
          </label>

          <div className="text-xs text-slate-500">
            “Keep only” removes everything else except whitespace/newlines for readability.
          </div>
        </div>

        {/* Find/replace + Extract */}
        <div className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="text-sm font-semibold text-slate-900">Find/Replace + Extract</div>

          <div className="grid gap-2">
            <label className="grid gap-1 text-sm text-slate-800">
              <span>Find (literal)</span>
              <input
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"
                value={findText}
                onChange={(e) => setFindText(e.target.value)}
                spellCheck={false}
              />
            </label>

            <label className="grid gap-1 text-sm text-slate-800">
              <span>Replace with</span>
              <input
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"
                value={replaceText}
                onChange={(e) => setReplaceText(e.target.value)}
                spellCheck={false}
              />
            </label>

            <Toggle checked={findCaseInsensitive} onChange={setFindCaseInsensitive} label="Find: case-insensitive" />
          </div>

          <div className="h-px bg-slate-200" />

          <label className="grid gap-1 text-sm text-slate-800">
            <span>Extract lines containing (literal)</span>
            <input
              className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"
              value={extractNeedle}
              onChange={(e) => setExtractNeedle(e.target.value)}
              spellCheck={false}
              placeholder="e.g. error, @gmail.com, Order ID"
            />
          </label>

          <div className="grid gap-2 sm:grid-cols-2">
            <Toggle checked={extractCaseInsensitive} onChange={setExtractCaseInsensitive} label="Extract: case-insensitive" />
            <Toggle checked={extractInvert} onChange={setExtractInvert} label="Invert (exclude matching lines)" />
          </div>

          <div className="text-xs text-slate-500">No regex here (safe + beginner-friendly).</div>
        </div>
      </div>

      {/* Prefix/Suffix + Line ops + Reverse */}
      <div className="grid gap-4 sm:grid-cols-3">
        {/* Prefix/Suffix */}
        <div className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="text-sm font-semibold text-slate-900">Prefix / Suffix each line</div>

          <label className="grid gap-1 text-sm text-slate-800">
            <span>Prefix</span>
            <input
              className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"
              value={prefix}
              onChange={(e) => setPrefix(e.target.value)}
              spellCheck={false}
              placeholder="e.g. - "
            />
          </label>

          <label className="grid gap-1 text-sm text-slate-800">
            <span>Suffix</span>
            <input
              className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"
              value={suffix}
              onChange={(e) => setSuffix(e.target.value)}
              spellCheck={false}
              placeholder="e.g. ;"
            />
          </label>

          <Toggle
            checked={skipEmptyLinesForAffixes}
            onChange={setSkipEmptyLinesForAffixes}
            label="Skip empty lines"
          />

          <div className="text-xs text-slate-500">
            Helpful for bullet lists, SQL lists, CSV quoting, etc.
          </div>
        </div>

        {/* Line ops */}
        <div className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="text-sm font-semibold text-slate-900">Line operations</div>

          <Toggle checked={dedupeLines} onChange={setDedupeLines} label="Remove duplicate lines" />
          <Toggle
            checked={dedupeCaseInsensitive}
            onChange={setDedupeCaseInsensitive}
            label="Case-insensitive duplicates"
            disabled={!dedupeLines}
          />

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

          <Toggle checked={lineNumbers} onChange={setLineNumbers} label="Add line numbers" />
          <label className="grid gap-1 text-sm text-slate-800">
            <span>Line number start</span>
            <input
              className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"
              type="number"
              min={1}
              value={lineNumberStart}
              onChange={(e) => setLineNumberStart(Number(e.target.value))}
              disabled={!lineNumbers}
            />
          </label>
        </div>

        {/* Reverse */}
        <div className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="text-sm font-semibold text-slate-900">Reverse</div>

          <div className="grid gap-2">
            <Button type="button" onClick={() => setReverseMode("none")} className={reverseMode === "none" ? "border-blue-500 bg-blue-50" : ""}>
              No reverse
            </Button>
            <Button type="button" onClick={() => setReverseMode("chars")} className={reverseMode === "chars" ? "border-blue-500 bg-blue-50" : ""}>
              Reverse characters
            </Button>
            <Button type="button" onClick={() => setReverseMode("words")} className={reverseMode === "words" ? "border-blue-500 bg-blue-50" : ""}>
              Reverse word order
            </Button>
            <Button type="button" onClick={() => setReverseMode("lines")} className={reverseMode === "lines" ? "border-blue-500 bg-blue-50" : ""}>
              Reverse line order
            </Button>
          </div>

          <div className="text-xs text-slate-500">
            Output is plain text. (Emoji sequences may not reverse perfectly.)
          </div>
        </div>
      </div>

      {/* Output */}
      <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm font-semibold text-slate-900">Output</div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={download} disabled={!output || overCap}>Download</Button>
            <Button type="button" onClick={copy} disabled={!output || overCap}>Copy</Button>
            <Button type="button" onClick={clear}>Clear</Button>
            <Button type="button" onClick={reset}>Reset</Button>
          </div>
        </div>

        <Textarea value={output} readOnly rows={12} />
        <div className="text-xs text-slate-500">Plain text output only (safe by design).</div>
      </div>
    </div>
  );
}
>>>>>>> a38c6781ba02f0335e4b9de11228d87416afd174
