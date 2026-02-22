import type { TransformDefinition } from "./types";

type LineEnding = "LF" | "CRLF";

type WhitespaceOptions = {
  lineEndings: LineEnding;
  removeTrailingSpaces: boolean;
  collapseBlankLines: boolean;
  maxBlankLines: number;
  ensureFinalNewline: boolean;
};

function normalizeNewlinesToLF(text: string): string {
  return text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

function toTargetLineEndings(text: string, target: LineEnding): string {
  const lf = normalizeNewlinesToLF(text);
  if (target === "CRLF") return lf.replace(/\n/g, "\r\n");
  return lf;
}

function removeTrailingSpaces(text: string): string {
  const lf = normalizeNewlinesToLF(text);
  return lf
    .split("\n")
    .map((line) => line.replace(/[ \t]+$/g, ""))
    .join("\n");
}

function collapseBlankLines(text: string, maxBlanks: number): string {
  const lf = normalizeNewlinesToLF(text);
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

function ensureFinalNewline(text: string, target: LineEnding): string {
  if (!text) return text;
  if (text.endsWith("\n") || text.endsWith("\r\n")) return text;
  return text + (target === "CRLF" ? "\r\n" : "\n");
}

export const whitespaceNormalizeTransform: TransformDefinition<WhitespaceOptions> = {
  id: "whitespace/normalize",
  name: "Whitespace normalize",
  description: "Normalize line endings and whitespace cleanup.",
  schema: {
    fields: [
      {
        key: "lineEndings",
        label: "Line endings",
        type: "select",
        default: "LF",
        options: [
          { value: "LF", label: "LF (Unix)" },
          { value: "CRLF", label: "CRLF (Windows)" },
        ],
      },
      { key: "removeTrailingSpaces", label: "Remove trailing spaces", type: "boolean", default: true },
      { key: "collapseBlankLines", label: "Collapse blank lines", type: "boolean", default: true },
      { key: "maxBlankLines", label: "Max blank lines", type: "number", default: 1, min: 0, max: 10, step: 1 },
      { key: "ensureFinalNewline", label: "Ensure final newline", type: "boolean", default: false },
    ],
  },
  apply: (input, opts) => {
    let out = normalizeNewlinesToLF(input);

    if (opts.removeTrailingSpaces) out = removeTrailingSpaces(out);
    if (opts.collapseBlankLines) out = collapseBlankLines(out, opts.maxBlankLines);

    out = toTargetLineEndings(out, opts.lineEndings);

    if (opts.ensureFinalNewline) out = ensureFinalNewline(out, opts.lineEndings);

    return out;
  },
};