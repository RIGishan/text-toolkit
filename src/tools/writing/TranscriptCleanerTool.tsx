import { useMemo, useState } from "react";
import { Button } from "../../components/ui/Button";
import { Textarea } from "../../components/ui/Textarea";
import { Toggle } from "../../components/ui/Toggle";
import { downloadTextFile } from "../../lib/download";
import { useDebouncedValue } from "../../lib/useDebouncedValue";

import { useToolContext } from "../../app/toolContext";
import { useToolState } from "../../lib/useToolState";

function normalizeNewlines(text: string): string {
  return text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

function removeTimestamps(text: string): string {
  // Removes common timestamps at line start or inline:
  // [00:12], (00:12), 00:12, 00:12:34, 1:02:03
  // Also removes leading "00:12 - " patterns.
  return text
    .replace(/^\s*(?:\[|\()?\s*\d{1,2}:\d{2}(?::\d{2})?\s*(?:\]|\))?\s*[-–—]?\s*/gm, "")
    .replace(/\s*(?:\[|\()?\s*\d{1,2}:\d{2}(?::\d{2})?\s*(?:\]|\))?\s*/g, " ");
}

function normalizeSpeakerLabels(text: string): string {
  // Normalizes common speaker label styles to: "Speaker: ..."
  // Examples:
  // SPEAKER 1 - hi
  // Speaker1: hi
  // John Doe — hi
  // We'll only normalize when it looks like a label at line start.
  return text.replace(
    /^\s*([A-Za-z][A-Za-z0-9 _.'-]{0,40})\s*(?:\:|\-|\—|\–)\s+/gm,
    (_m, name) => {
      const n = String(name).trim().replace(/\s{2,}/g, " ");
      return `${n}: `;
    }
  );
}

const FILLER_WORDS = ["um", "uh", "like", "you know", "i mean", "sort of", "kind of", "actually", "basically"];

function removeFillers(text: string): string {
  // Conservative: remove fillers when surrounded by word boundaries, keeping punctuation spacing reasonable.
  let out = text;
  for (const f of FILLER_WORDS) {
    const re = new RegExp(`\\b${f.replace(/\s+/g, "\\s+")}\\b`, "gi");
    out = out.replace(re, "");
  }
  // cleanup extra spaces caused by removals
  out = out.replace(/[ \t]{2,}/g, " ");
  out = out.replace(/\s+([,.;!?])/g, "$1");
  return out;
}

function tidyWhitespace(text: string): string {
  let out = normalizeNewlines(text);
  // remove trailing spaces
  out = out.replace(/[ \t]+$/gm, "");
  // collapse 3+ blank lines to max 2
  out = out.replace(/\n{3,}/g, "\n\n");
  return out.trim() + "\n";
}

const SAMPLE = `[00:01] SPEAKER 1 - Um, hello everyone.
(00:05) John Doe — like, I mean we should start now.
00:12 Jane: Uh, yeah, basically the agenda is...
00:20 - SPEAKER 1: You know, let's do it.

[00:33] John Doe: Great!`;

export function TranscriptCleanerTool() {
  const { toolId } = useToolContext();

  // Input is NOT part of recipes (users paste new transcripts all the time)
  const [input, setInput] = useState(SAMPLE);

  // Options ARE part of recipes
  const DEFAULTS = {
    stripTimestamps: true,
    normalizeSpeakers: true,
    removeFillerWords: false,
    normalizeWhitespace: true,
  };

  const [opts, setOpts] = useToolState(toolId, DEFAULTS);

  const { stripTimestamps, normalizeSpeakers, removeFillerWords, normalizeWhitespace } = opts;

  const debounced = useDebouncedValue(input, 150);

  const output = useMemo(() => {
    if (!debounced.trim()) return "";

    let out = debounced;

    if (stripTimestamps) out = removeTimestamps(out);
    if (normalizeSpeakers) out = normalizeSpeakerLabels(out);
    if (removeFillerWords) out = removeFillers(out);
    if (normalizeWhitespace) out = tidyWhitespace(out);
    else out = normalizeNewlines(out);

    return out;
  }, [debounced, stripTimestamps, normalizeSpeakers, removeFillerWords, normalizeWhitespace]);

  async function copy() {
    await navigator.clipboard.writeText(output);
  }

  function download() {
    downloadTextFile("cleaned-transcript.txt", output);
  }

  function reset() {
    setInput(SAMPLE);
    setOpts(DEFAULTS);
  }

  return (
    <div className="grid gap-6">
      {/* Input */}
      <div className="grid gap-3">
        <div className="text-sm font-semibold text-slate-900">Transcript input</div>
        <Textarea value={input} onChange={(e) => setInput(e.target.value)} rows={12} spellCheck={false} />
      </div>

      {/* Options */}
      <div className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <div className="text-sm font-semibold text-slate-900">Options</div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-white p-3">
            <Toggle
              checked={stripTimestamps}
              onChange={(v) => setOpts((p) => ({ ...p, stripTimestamps: v }))}
              label="Remove timestamps"
            />
            <div className="mt-1 text-xs text-slate-500">Catches common formats like [00:12], 00:12:34, etc.</div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-3">
            <Toggle
              checked={normalizeSpeakers}
              onChange={(v) => setOpts((p) => ({ ...p, normalizeSpeakers: v }))}
              label="Normalize speaker labels"
            />
            <div className="mt-1 text-xs text-slate-500">Converts “Name - …” → “Name: …” at line start.</div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-3">
            <Toggle
              checked={removeFillerWords}
              onChange={(v) => setOpts((p) => ({ ...p, removeFillerWords: v }))}
              label="Remove filler words (conservative)"
            />
            <div className="mt-1 text-xs text-slate-500">Removes um/uh/like/you know/etc. (best-effort).</div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-3">
            <Toggle
              checked={normalizeWhitespace}
              onChange={(v) => setOpts((p) => ({ ...p, normalizeWhitespace: v }))}
              label="Normalize whitespace"
            />
            <div className="mt-1 text-xs text-slate-500">Trims trailing spaces and collapses extra blank lines.</div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={copy} disabled={!output.trim()}>
            Copy
          </Button>
          <Button type="button" onClick={download} disabled={!output.trim()}>
            Download
          </Button>
          <Button type="button" onClick={reset}>
            Reset
          </Button>
        </div>
      </div>

      {/* Output */}
      <div className="grid gap-2">
        <div className="text-sm font-semibold text-slate-900">Cleaned output</div>
        <Textarea value={output} readOnly rows={14} />
        <div className="text-xs text-slate-500">Plain text output only.</div>
      </div>
    </div>
  );
}
