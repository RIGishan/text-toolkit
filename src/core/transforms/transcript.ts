import type { TransformDefinition } from "./types";

type TranscriptOptions = {
  removeTimestamps: boolean;
  normalizeSpeakers: boolean;
  removeFillers: boolean;
  normalizeWhitespace: boolean;
};

function normalizeNewlines(text: string): string {
  return text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

function removeTimestamps(text: string): string {
  return text
    .replace(/^\s*(?:\[|\()?\s*\d{1,2}:\d{2}(?::\d{2})?\s*(?:\]|\))?\s*[-–—]?\s*/gm, "")
    .replace(/\s*(?:\[|\()?\s*\d{1,2}:\d{2}(?::\d{2})?\s*(?:\]|\))?\s*/g, " ");
}

function normalizeSpeakerLabels(text: string): string {
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
  let out = text;
  for (const f of FILLER_WORDS) {
    const re = new RegExp(`\\b${f.replace(/\s+/g, "\\s+")}\\b`, "gi");
    out = out.replace(re, "");
  }
  out = out.replace(/[ \t]{2,}/g, " ");
  out = out.replace(/\s+([,.;!?])/g, "$1");
  return out;
}

function tidyWhitespace(text: string): string {
  let out = normalizeNewlines(text);
  out = out.replace(/[ \t]+$/gm, "");
  out = out.replace(/\n{3,}/g, "\n\n");
  return out.trim() + "\n";
}

export const transcriptCleanTransform: TransformDefinition<TranscriptOptions> = {
  id: "transcript/clean",
  name: "Transcript clean",
  description: "Remove timestamps, normalize speaker labels, optional filler cleanup.",
  schema: {
    fields: [
      { key: "removeTimestamps", label: "Remove timestamps", type: "boolean", default: true },
      { key: "normalizeSpeakers", label: "Normalize speaker labels", type: "boolean", default: true },
      { key: "removeFillers", label: "Remove filler words (best-effort)", type: "boolean", default: false },
      { key: "normalizeWhitespace", label: "Normalize whitespace", type: "boolean", default: true },
    ],
  },
  apply: (input, opts) => {
    let out = input;

    if (opts.removeTimestamps) out = removeTimestamps(out);
    if (opts.normalizeSpeakers) out = normalizeSpeakerLabels(out);
    if (opts.removeFillers) out = removeFillers(out);

    if (opts.normalizeWhitespace) out = tidyWhitespace(out);
    else out = normalizeNewlines(out);

    return out;
  },
};