import { useMemo, useState } from "react";
import { Button } from "../../components/ui/Button";
import { Textarea } from "../../components/ui/Textarea";
import { Toggle } from "../../components/ui/Toggle";
import { downloadTextFile } from "../../lib/download";

type Intent = "Informational" | "Commercial" | "Transactional" | "Navigational" | "Local" | "Unclear";

const INTENT_RULES: { intent: Intent; words: string[] }[] = [
  { intent: "Transactional", words: ["buy", "price", "pricing", "order", "discount", "coupon", "deal", "cheap", "subscribe", "download"] },
  { intent: "Commercial", words: ["best", "top", "review", "vs", "compare", "comparison", "alternative", "alternatives", "tool", "tools", "software"] },
  { intent: "Informational", words: ["how", "what", "why", "guide", "tutorial", "tips", "example", "examples", "learn", "meaning"] },
  { intent: "Navigational", words: ["login", "signin", "sign in", "official", "website", "homepage", "docs", "documentation"] },
  { intent: "Local", words: ["near me", "nearby", "open now", "hours", "directions", "map", "in "] } // "in " used lightly
];

function normalize(s: string): string {
  return (s || "").trim().toLowerCase().replace(/\s+/g, " ");
}

function tokenize(s: string): string[] {
  return normalize(s)
    .split(" ")
    .map((t) => t.replace(/[^a-z0-9-]/g, ""))
    .filter(Boolean);
}

function stemToken(t: string): string {
  // Simple deterministic stemmer (very light, avoids heavy NLP)
  let x = t;
  if (x.endsWith("ing") && x.length > 5) x = x.slice(0, -3);
  else if (x.endsWith("ed") && x.length > 4) x = x.slice(0, -2);
  else if (x.endsWith("es") && x.length > 4) x = x.slice(0, -2);
  else if (x.endsWith("s") && x.length > 3) x = x.slice(0, -1);
  return x;
}

function detectIntent(keyword: string): Intent {
  const k = normalize(keyword);
  for (const rule of INTENT_RULES) {
    for (const w of rule.words) {
      if (w.endsWith(" ") || w.includes(" ")) {
        // phrase match
        if (k.includes(w)) return rule.intent;
      } else {
        // word-ish match
        const toks = tokenize(k);
        if (toks.includes(w)) return rule.intent;
      }
    }
  }
  return "Unclear";
}

function groupByStem(keywords: string[]): Map<string, string[]> {
  const map = new Map<string, string[]>();

  for (const kw of keywords) {
    const toks = tokenize(kw).map(stemToken);
    // Pick a "primary stem": longest token tends to represent the topic
    const primary = toks.sort((a, b) => b.length - a.length)[0] || "other";
    const key = primary;
    const list = map.get(key) ?? [];
    list.push(kw);
    map.set(key, list);
  }

  return map;
}

function uniqLines(text: string): string[] {
  const lines = text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  const seen = new Set<string>();
  const out: string[] = [];
  for (const l of lines) {
    const key = normalize(l);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(l);
  }
  return out;
}

export function KeywordGrouperTool() {
  const [input, setInput] = useState(
    `json formatter
best json formatter
how to format json
openai docs
buy json tool
json formatter near me
csv to json converter
compare csv converter tools`
  );

  const [dedupe, setDedupe] = useState(true);
  const [groupByTopic, setGroupByTopic] = useState(true);

  const keywords = useMemo(() => {
    const lines = dedupe ? uniqLines(input) : input.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    return lines;
  }, [input, dedupe]);

  const byIntent = useMemo(() => {
    const map = new Map<Intent, string[]>();
    for (const kw of keywords) {
      const intent = detectIntent(kw);
      const arr = map.get(intent) ?? [];
      arr.push(kw);
      map.set(intent, arr);
    }
    return map;
  }, [keywords]);

  const output = useMemo(() => {
    const sections: string[] = [];
    const intents: Intent[] = ["Informational", "Commercial", "Transactional", "Navigational", "Local", "Unclear"];

    for (const intent of intents) {
      const list = byIntent.get(intent) ?? [];
      if (list.length === 0) continue;

      sections.push(`# ${intent} (${list.length})`);

      if (!groupByTopic) {
        sections.push(...list.map((k) => `- ${k}`));
        sections.push("");
        continue;
      }

      const stemGroups = groupByStem(list);
      // sort groups by size desc
      const sorted = Array.from(stemGroups.entries()).sort((a, b) => b[1].length - a[1].length);

      for (const [stem, items] of sorted) {
        sections.push(`## Topic: ${stem} (${items.length})`);
        sections.push(...items.map((k) => `- ${k}`));
        sections.push("");
      }
    }

    if (sections.length === 0) return "Paste keywords (one per line) to group them.";
    return sections.join("\n").trim() + "\n";
  }, [byIntent, groupByTopic]);

  async function copy() {
    await navigator.clipboard.writeText(output);
  }

  function download() {
    downloadTextFile("keyword-groups.txt", output);
  }

  function reset() {
    setInput(
      `json formatter
best json formatter
how to format json
openai docs
buy json tool
json formatter near me
csv to json converter
compare csv converter tools`
    );
    setDedupe(true);
    setGroupByTopic(true);
  }

  return (
    <div className="grid gap-6">
      {/* Input */}
      <div className="grid gap-3">
        <div className="text-sm font-semibold text-slate-900">Keywords (one per line)</div>
        <Textarea value={input} onChange={(e) => setInput(e.target.value)} rows={10} spellCheck={false} />
        <div className="text-xs text-slate-500">
          Deterministic heuristics only (no AI). Results are best-effort.
        </div>
      </div>

      {/* Options */}
      <div className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <div className="text-sm font-semibold text-slate-900">Options</div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-white p-3">
            <Toggle checked={dedupe} onChange={setDedupe} label="Remove duplicate lines" />
            <div className="mt-1 text-xs text-slate-500">Duplicate detection is case-insensitive.</div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-3">
            <Toggle checked={groupByTopic} onChange={setGroupByTopic} label="Group by topic stems (within intent)" />
            <div className="mt-1 text-xs text-slate-500">Topic grouping uses a lightweight stem heuristic.</div>
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
        <div className="text-sm font-semibold text-slate-900">Grouped output</div>
        <Textarea value={output} readOnly rows={14} />
        <div className="text-xs text-slate-500">
          Output is plain text; you can paste into docs/spreadsheets.
        </div>
      </div>
    </div>
  );
}
