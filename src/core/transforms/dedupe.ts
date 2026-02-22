import type { TransformDefinition } from "./types";

type DedupeOptions = {
  caseSensitive: boolean;
  keepFirst: boolean;
  trimLines: boolean;
  removeEmpty: boolean;
};

function normalizeNewlines(text: string): string {
  return text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

export const dedupeLinesTransform: TransformDefinition<DedupeOptions> = {
  id: "text/dedupe-lines",
  name: "Dedupe lines",
  description: "Remove duplicate lines (useful after extract/cleanup).",
  schema: {
    fields: [
      { key: "caseSensitive", label: "Case sensitive", type: "boolean", default: false },
      { key: "keepFirst", label: "Keep first occurrence", type: "boolean", default: true },
      { key: "trimLines", label: "Trim each line", type: "boolean", default: true },
      { key: "removeEmpty", label: "Remove empty lines", type: "boolean", default: true },
    ],
  },
  apply: (input, opts) => {
    const lf = normalizeNewlines(input);
    const lines = lf.split("\n").map((l) => (opts.trimLines ? l.trim() : l));

    const seen = new Set<string>();
    const out: string[] = [];

    for (const line of lines) {
      const isEmpty = line.length === 0;
      if (opts.removeEmpty && isEmpty) continue;

      const key = opts.caseSensitive ? line : line.toLowerCase();
      const has = seen.has(key);

      if (!has) {
        seen.add(key);
        out.push(line);
      } else if (!opts.keepFirst) {
        // keep last: replace previous occurrence by removing it and re-adding
        // (simple and fine for MVP)
        const idx = out.findIndex((x) => (opts.caseSensitive ? x === line : x.toLowerCase() === key));
        if (idx >= 0) out.splice(idx, 1);
        out.push(line);
      }
    }

    return out.join("\n");
  },
};