<<<<<<< HEAD
import { useMemo, useState } from "react";
import { Button } from "../../components/ui/Button";
import { Textarea } from "../../components/ui/Textarea";
import { downloadTextFile } from "../../lib/download";

const POWER_WORDS = [
  "free",
  "easy",
  "simple",
  "fast",
  "quick",
  "proven",
  "ultimate",
  "best",
  "smart",
  "secure",
  "modern",
  "minimal",
  "powerful",
  "instant",
  "local",
  "browser-only",
  "no uploads",
  "step-by-step"
];

function wordsOf(text: string): string[] {
  return (text || "")
    .trim()
    .split(/\s+/)
    .map((w) => w.trim())
    .filter(Boolean);
}

function countSyllablesApprox(word: string): number {
  // Very rough heuristic, but stable and deterministic
  const w = word.toLowerCase().replace(/[^a-z]/g, "");
  if (!w) return 0;
  if (w.length <= 3) return 1;

  const groups = w.match(/[aeiouy]+/g);
  let count = groups ? groups.length : 1;

  // silent e
  if (w.endsWith("e")) count -= 1;
  if (count < 1) count = 1;
  return count;
}

function readabilityHeuristic(text: string): { score: number; note: string } {
  const words = wordsOf(text);
  const wordCount = words.length;
  const charCount = text.length;

  if (wordCount === 0) return { score: 0, note: "No text" };

  const syllables = words.reduce((acc, w) => acc + countSyllablesApprox(w), 0);

  // A simple composite: prefers 6–12 words, moderate char length, fewer syllables.
  // Output score 0..100
  const idealWords = 10;
  const wordPenalty = Math.min(60, Math.abs(wordCount - idealWords) * 6);
  const charPenalty = Math.min(25, Math.abs(charCount - 55) * 0.5);
  const syllPenalty = Math.min(25, Math.max(0, (syllables / wordCount - 1.6) * 40));

  let score = 100 - wordPenalty - charPenalty - syllPenalty;
  score = Math.max(0, Math.min(100, Math.round(score)));

  const note =
    score >= 80
      ? "Very readable"
      : score >= 60
        ? "Readable"
        : score >= 40
          ? "Somewhat dense"
          : "Hard to scan";

  return { score, note };
}

function toTitleCase(s: string): string {
  const small = new Set(["a", "an", "and", "or", "the", "to", "of", "in", "for", "on", "with"]);
  const parts = (s || "").split(/\s+/);
  return parts
    .map((p, idx) => {
      const lower = p.toLowerCase();
      if (idx !== 0 && small.has(lower)) return lower;
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(" ");
}

function dedupeStable(list: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const x of list) {
    const key = x.trim();
    if (!key) continue;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(key);
  }
  return out;
}

function generateVariants(headline: string): string[] {
  const h = headline.trim();
  if (!h) return [];

  const w = wordsOf(h);
  const base = h.replace(/\s+/g, " ").trim();

  const variants: string[] = [];

  // 1) Title Case
  variants.push(toTitleCase(base));

  // 2) Add "Free" prefix
  variants.push(`Free: ${base}`);

  // 3) Add "How to" prefix if not already
  if (!/^how to\b/i.test(base)) variants.push(`How to ${base.charAt(0).toLowerCase() + base.slice(1)}`);

  // 4) Add "in minutes"
  variants.push(`${base} in Minutes`);

  // 5) Add "Step-by-step"
  variants.push(`${base} (Step-by-step)`);

  // 6) Make shorter: take first 8 words
  if (w.length > 8) variants.push(wordsOf(base).slice(0, 8).join(" ") + "…");

  // 7) Add benefit suffix
  variants.push(`${base} — Faster & Cleaner`);

  // 8) Question form
  variants.push(`Want to ${base.replace(/^[A-Z]/, (m) => m.toLowerCase())}?`);

  // 9) “No uploads”
  variants.push(`${base} (No Uploads)`);

  // 10) “Browser-only”
  variants.push(`${base} (Browser-only)`);

  return dedupeStable(variants).slice(0, 10);
}

function countPowerWords(text: string): number {
  const t = text.toLowerCase();
  let count = 0;
  for (const w of POWER_WORDS) {
    if (t.includes(w)) count++;
  }
  return count;
}

export function HeadlineAnalyzerTool() {
  const [headline, setHeadline] = useState("Text Toolkit: Browser-only Utilities That Run Locally (No Uploads)");

  const words = useMemo(() => wordsOf(headline), [headline]);
  const wordCount = words.length;
  const charCount = headline.length;

  const punctuationCount = useMemo(() => {
    const m = headline.match(/[!?.,:;()—-]/g);
    return m ? m.length : 0;
  }, [headline]);

  const powerCount = useMemo(() => countPowerWords(headline), [headline]);
  const readability = useMemo(() => readabilityHeuristic(headline), [headline]);

  const variants = useMemo(() => generateVariants(headline), [headline]);

  const variantsText = useMemo(() => variants.map((v, i) => `${i + 1}. ${v}`).join("\n"), [variants]);

  async function copyVariants() {
    await navigator.clipboard.writeText(variantsText);
  }

  function downloadVariants() {
    downloadTextFile("headline-variants.txt", variantsText);
  }

  function reset() {
    setHeadline("Text Toolkit: Browser-only Utilities That Run Locally (No Uploads)");
  }

  return (
    <div className="grid gap-6">
      {/* Input */}
      <div className="grid gap-2">
        <div className="text-sm font-semibold text-slate-900">Headline</div>
        <input
          className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm"
          value={headline}
          onChange={(e) => setHeadline(e.target.value)}
          placeholder="Type your headline…"
          spellCheck={false}
        />
        <div className="text-xs text-slate-500">
          Characters: {charCount} • Words: {wordCount}
        </div>
      </div>

      {/* Metrics */}
      <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="text-sm font-semibold text-slate-900">Metrics</div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Length</div>
            <div className="mt-1 text-lg font-semibold text-slate-900">{charCount}</div>
            <div className="text-xs text-slate-500">Often best ~40–60 chars</div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Power words</div>
            <div className="mt-1 text-lg font-semibold text-slate-900">{powerCount}</div>
            <div className="text-xs text-slate-500">Based on a small built-in list</div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Punctuation</div>
            <div className="mt-1 text-lg font-semibold text-slate-900">{punctuationCount}</div>
            <div className="text-xs text-slate-500">Too much can reduce clarity</div>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Readability</div>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <div className="text-lg font-semibold text-slate-900">{readability.score}/100</div>
            <div className="text-sm text-slate-700">{readability.note}</div>
          </div>
          <div className="mt-1 text-xs text-slate-500">
            Deterministic heuristic (not a scientific reading grade).
          </div>
        </div>
      </div>

      {/* Variants */}
      <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm font-semibold text-slate-900">Variants (10)</div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={copyVariants} disabled={!variantsText.trim()}>
              Copy
            </Button>
            <Button type="button" onClick={downloadVariants} disabled={!variantsText.trim()}>
              Download
            </Button>
            <Button type="button" onClick={reset}>
              Reset
            </Button>
          </div>
        </div>

        <Textarea value={variantsText} readOnly rows={10} />
        <div className="text-xs text-slate-500">
          These are rule-based and deterministic (no AI).
        </div>
      </div>
    </div>
  );
}
=======
import { useMemo, useState } from "react";
import { Button } from "../../components/ui/Button";
import { Textarea } from "../../components/ui/Textarea";
import { downloadTextFile } from "../../lib/download";

const POWER_WORDS = [
  "free",
  "easy",
  "simple",
  "fast",
  "quick",
  "proven",
  "ultimate",
  "best",
  "smart",
  "secure",
  "modern",
  "minimal",
  "powerful",
  "instant",
  "local",
  "browser-only",
  "no uploads",
  "step-by-step"
];

function wordsOf(text: string): string[] {
  return (text || "")
    .trim()
    .split(/\s+/)
    .map((w) => w.trim())
    .filter(Boolean);
}

function countSyllablesApprox(word: string): number {
  // Very rough heuristic, but stable and deterministic
  const w = word.toLowerCase().replace(/[^a-z]/g, "");
  if (!w) return 0;
  if (w.length <= 3) return 1;

  const groups = w.match(/[aeiouy]+/g);
  let count = groups ? groups.length : 1;

  // silent e
  if (w.endsWith("e")) count -= 1;
  if (count < 1) count = 1;
  return count;
}

function readabilityHeuristic(text: string): { score: number; note: string } {
  const words = wordsOf(text);
  const wordCount = words.length;
  const charCount = text.length;

  if (wordCount === 0) return { score: 0, note: "No text" };

  const syllables = words.reduce((acc, w) => acc + countSyllablesApprox(w), 0);

  // A simple composite: prefers 6–12 words, moderate char length, fewer syllables.
  // Output score 0..100
  const idealWords = 10;
  const wordPenalty = Math.min(60, Math.abs(wordCount - idealWords) * 6);
  const charPenalty = Math.min(25, Math.abs(charCount - 55) * 0.5);
  const syllPenalty = Math.min(25, Math.max(0, (syllables / wordCount - 1.6) * 40));

  let score = 100 - wordPenalty - charPenalty - syllPenalty;
  score = Math.max(0, Math.min(100, Math.round(score)));

  const note =
    score >= 80
      ? "Very readable"
      : score >= 60
        ? "Readable"
        : score >= 40
          ? "Somewhat dense"
          : "Hard to scan";

  return { score, note };
}

function toTitleCase(s: string): string {
  const small = new Set(["a", "an", "and", "or", "the", "to", "of", "in", "for", "on", "with"]);
  const parts = (s || "").split(/\s+/);
  return parts
    .map((p, idx) => {
      const lower = p.toLowerCase();
      if (idx !== 0 && small.has(lower)) return lower;
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(" ");
}

function dedupeStable(list: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const x of list) {
    const key = x.trim();
    if (!key) continue;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(key);
  }
  return out;
}

function generateVariants(headline: string): string[] {
  const h = headline.trim();
  if (!h) return [];

  const w = wordsOf(h);
  const base = h.replace(/\s+/g, " ").trim();

  const variants: string[] = [];

  // 1) Title Case
  variants.push(toTitleCase(base));

  // 2) Add "Free" prefix
  variants.push(`Free: ${base}`);

  // 3) Add "How to" prefix if not already
  if (!/^how to\b/i.test(base)) variants.push(`How to ${base.charAt(0).toLowerCase() + base.slice(1)}`);

  // 4) Add "in minutes"
  variants.push(`${base} in Minutes`);

  // 5) Add "Step-by-step"
  variants.push(`${base} (Step-by-step)`);

  // 6) Make shorter: take first 8 words
  if (w.length > 8) variants.push(wordsOf(base).slice(0, 8).join(" ") + "…");

  // 7) Add benefit suffix
  variants.push(`${base} — Faster & Cleaner`);

  // 8) Question form
  variants.push(`Want to ${base.replace(/^[A-Z]/, (m) => m.toLowerCase())}?`);

  // 9) “No uploads”
  variants.push(`${base} (No Uploads)`);

  // 10) “Browser-only”
  variants.push(`${base} (Browser-only)`);

  return dedupeStable(variants).slice(0, 10);
}

function countPowerWords(text: string): number {
  const t = text.toLowerCase();
  let count = 0;
  for (const w of POWER_WORDS) {
    if (t.includes(w)) count++;
  }
  return count;
}

export function HeadlineAnalyzerTool() {
  const [headline, setHeadline] = useState("Text Toolkit: Browser-only Utilities That Run Locally (No Uploads)");

  const words = useMemo(() => wordsOf(headline), [headline]);
  const wordCount = words.length;
  const charCount = headline.length;

  const punctuationCount = useMemo(() => {
    const m = headline.match(/[!?.,:;()—-]/g);
    return m ? m.length : 0;
  }, [headline]);

  const powerCount = useMemo(() => countPowerWords(headline), [headline]);
  const readability = useMemo(() => readabilityHeuristic(headline), [headline]);

  const variants = useMemo(() => generateVariants(headline), [headline]);

  const variantsText = useMemo(() => variants.map((v, i) => `${i + 1}. ${v}`).join("\n"), [variants]);

  async function copyVariants() {
    await navigator.clipboard.writeText(variantsText);
  }

  function downloadVariants() {
    downloadTextFile("headline-variants.txt", variantsText);
  }

  function reset() {
    setHeadline("Text Toolkit: Browser-only Utilities That Run Locally (No Uploads)");
  }

  return (
    <div className="grid gap-6">
      {/* Input */}
      <div className="grid gap-2">
        <div className="text-sm font-semibold text-slate-900">Headline</div>
        <input
          className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm"
          value={headline}
          onChange={(e) => setHeadline(e.target.value)}
          placeholder="Type your headline…"
          spellCheck={false}
        />
        <div className="text-xs text-slate-500">
          Characters: {charCount} • Words: {wordCount}
        </div>
      </div>

      {/* Metrics */}
      <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="text-sm font-semibold text-slate-900">Metrics</div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Length</div>
            <div className="mt-1 text-lg font-semibold text-slate-900">{charCount}</div>
            <div className="text-xs text-slate-500">Often best ~40–60 chars</div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Power words</div>
            <div className="mt-1 text-lg font-semibold text-slate-900">{powerCount}</div>
            <div className="text-xs text-slate-500">Based on a small built-in list</div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Punctuation</div>
            <div className="mt-1 text-lg font-semibold text-slate-900">{punctuationCount}</div>
            <div className="text-xs text-slate-500">Too much can reduce clarity</div>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Readability</div>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <div className="text-lg font-semibold text-slate-900">{readability.score}/100</div>
            <div className="text-sm text-slate-700">{readability.note}</div>
          </div>
          <div className="mt-1 text-xs text-slate-500">
            Deterministic heuristic (not a scientific reading grade).
          </div>
        </div>
      </div>

      {/* Variants */}
      <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm font-semibold text-slate-900">Variants (10)</div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={copyVariants} disabled={!variantsText.trim()}>
              Copy
            </Button>
            <Button type="button" onClick={downloadVariants} disabled={!variantsText.trim()}>
              Download
            </Button>
            <Button type="button" onClick={reset}>
              Reset
            </Button>
          </div>
        </div>

        <Textarea value={variantsText} readOnly rows={10} />
        <div className="text-xs text-slate-500">
          These are rule-based and deterministic (no AI).
        </div>
      </div>
    </div>
  );
}
>>>>>>> a38c6781ba02f0335e4b9de11228d87416afd174
