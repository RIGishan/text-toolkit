import { useMemo, useState } from "react";
import { Button } from "../../components/ui/Button";
import { Textarea } from "../../components/ui/Textarea";
import { Toggle } from "../../components/ui/Toggle";
import { downloadTextFile } from "../../lib/download";

function stripUrls(text: string): string {
  // Simple URL removal: http(s) + www + naked domains with paths can be too aggressive;
  // keep it conservative for "exclude URLs" option.
  return text.replace(/\bhttps?:\/\/[^\s<>"']+/gi, "").replace(/\bwww\.[^\s<>"']+/gi, "");
}

function stripMarkdownCodeFences(text: string): string {
  // Remove ``` ... ``` blocks (multi-line)
  return text.replace(/```[\s\S]*?```/g, "");
}

function normalizeNewlines(text: string): string {
  return text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

function countWords(text: string): number {
  // Count word-like tokens (letters/numbers/apostrophes/hyphens inside)
  const m = text.match(/\b[\p{L}\p{N}]+(?:[’'][\p{L}\p{N}]+)?(?:-[\p{L}\p{N}]+)*\b/gu);
  return m ? m.length : 0;
}

function countSentences(text: string): number {
  const t = text.trim();
  if (!t) return 0;
  // naive sentence boundary: ., !, ? followed by whitespace or end
  const m = t.match(/[.!?]+(?=\s|$)/g);
  return m ? m.length : 1;
}

function countParagraphs(text: string): number {
  const t = normalizeNewlines(text).trim();
  if (!t) return 0;
  return t.split(/\n\s*\n/).filter((p) => p.trim().length > 0).length;
}

function minutesRoundedUp(n: number): number {
  return Math.max(1, Math.ceil(n));
}

export function SmartCounterTool() {
  const [input, setInput] = useState(
    `This is a sample paragraph.

It has two paragraphs, and a URL: https://example.com/page

\`\`\`
const secret = "not really";
console.log(secret);
\`\`\`
`
  );

  const [excludeUrls, setExcludeUrls] = useState(false);
  const [excludeCodeFences, setExcludeCodeFences] = useState(true);

  const processed = useMemo(() => {
    let t = input ?? "";
    if (excludeCodeFences) t = stripMarkdownCodeFences(t);
    if (excludeUrls) t = stripUrls(t);
    return t;
  }, [input, excludeUrls, excludeCodeFences]);

  const stats = useMemo(() => {
    const t = processed;
    const words = countWords(t);
    const charsWithSpaces = t.length;
    const charsNoSpaces = t.replace(/\s/g, "").length;
    const sentences = countSentences(t);
    const paragraphs = countParagraphs(t);

    // Typical averages:
    // reading: 200 wpm, speaking: 130 wpm
    const readingMin = words / 200;
    const speakingMin = words / 130;

    return {
      words,
      charsWithSpaces,
      charsNoSpaces,
      sentences,
      paragraphs,
      readingTimeMin: words === 0 ? 0 : minutesRoundedUp(readingMin),
      speakingTimeMin: words === 0 ? 0 : minutesRoundedUp(speakingMin)
    };
  }, [processed]);

  const report = useMemo(() => {
    return [
      `Words: ${stats.words}`,
      `Characters (with spaces): ${stats.charsWithSpaces}`,
      `Characters (no spaces): ${stats.charsNoSpaces}`,
      `Sentences: ${stats.sentences}`,
      `Paragraphs: ${stats.paragraphs}`,
      `Estimated reading time: ${stats.readingTimeMin} min (200 wpm)`,
      `Estimated speaking time: ${stats.speakingTimeMin} min (130 wpm)`,
      "",
      `Options:`,
      `- Exclude URLs: ${excludeUrls ? "On" : "Off"}`,
      `- Exclude Markdown code fences: ${excludeCodeFences ? "On" : "Off"}`
    ].join("\n");
  }, [stats, excludeUrls, excludeCodeFences]);

  async function copy() {
    await navigator.clipboard.writeText(report);
  }

  function download() {
    downloadTextFile("text-count-report.txt", report);
  }

  function reset() {
    setInput(
      `This is a sample paragraph.

It has two paragraphs, and a URL: https://example.com/page

\`\`\`
const secret = "not really";
console.log(secret);
\`\`\`
`
    );
    setExcludeUrls(false);
    setExcludeCodeFences(true);
  }

  return (
    <div className="grid gap-6">
      {/* Input */}
      <div className="grid gap-3">
        <div className="text-sm font-semibold text-slate-900">Input</div>
        <Textarea value={input} onChange={(e) => setInput(e.target.value)} rows={12} spellCheck={false} />
      </div>

      {/* Options */}
      <div className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <div className="text-sm font-semibold text-slate-900">Options</div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-white p-3">
            <Toggle checked={excludeUrls} onChange={setExcludeUrls} label="Exclude URLs from counts" />
            <div className="mt-1 text-xs text-slate-500">Removes http(s) and www links.</div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-3">
            <Toggle checked={excludeCodeFences} onChange={setExcludeCodeFences} label="Exclude Markdown code fences" />
            <div className="mt-1 text-xs text-slate-500">Removes ``` ... ``` blocks.</div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={copy}>
            Copy report
          </Button>
          <Button type="button" onClick={download}>
            Download report
          </Button>
          <Button type="button" onClick={reset}>
            Reset
          </Button>
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Words</div>
          <div className="mt-1 text-2xl font-semibold text-slate-900">{stats.words}</div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Characters</div>
          <div className="mt-1 text-2xl font-semibold text-slate-900">{stats.charsWithSpaces}</div>
          <div className="mt-1 text-xs text-slate-500">{stats.charsNoSpaces} (no spaces)</div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Structure</div>
          <div className="mt-1 text-sm text-slate-700">Sentences: <span className="font-mono">{stats.sentences}</span></div>
          <div className="mt-1 text-sm text-slate-700">Paragraphs: <span className="font-mono">{stats.paragraphs}</span></div>
        </div>
      </div>

      {/* Time estimates */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Reading time</div>
          <div className="mt-1 text-lg font-semibold text-slate-900">
            {stats.words === 0 ? "—" : `${stats.readingTimeMin} min`}
          </div>
          <div className="mt-1 text-xs text-slate-500">Assumes 200 words/min</div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Speaking time</div>
          <div className="mt-1 text-lg font-semibold text-slate-900">
            {stats.words === 0 ? "—" : `${stats.speakingTimeMin} min`}
          </div>
          <div className="mt-1 text-xs text-slate-500">Assumes 130 words/min</div>
        </div>
      </div>

      {/* Report */}
      <div className="grid gap-2">
        <div className="text-sm font-semibold text-slate-900">Report</div>
        <Textarea value={report} readOnly rows={10} />
        <div className="text-xs text-slate-500">Plain text output only.</div>
      </div>
    </div>
  );
}
