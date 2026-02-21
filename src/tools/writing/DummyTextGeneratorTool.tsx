import { useMemo, useState } from "react";
import { Button } from "../../components/ui/Button";
import { Textarea } from "../../components/ui/Textarea";
import { downloadTextFile } from "../../lib/download";

type Mode = "lorem" | "random";

const LOREM_WORDS = (
  "lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua " +
  "ut enim ad minim veniam quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat " +
  "duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur " +
  "excepteur sint occaecat cupidatat non proident sunt in culpa qui officia deserunt mollit anim id est laborum"
).split(/\s+/);

const RANDOM_WORDS = (
  "alpha brave canvas delta ember fable glide harbor ivory junction kindle lumen mellow nexus orbit pixel quartz ripple " +
  "summit timber unity velvet whisper xenon yonder zenith aurora beacon cipher drift echo forge grove horizon ignite jolt " +
  "keystone lantern mosaic nebula oasis prism quiver rocket signal thunder umbra voyager"
).split(/\s+/);

function clampInt(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, Math.floor(n)));
}

function pickWords(wordList: string[], count: number): string[] {
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    out.push(wordList[i % wordList.length]);
  }
  return out;
}

function generateText(mode: Mode, paragraphs: number, wordsPerParagraph: number): string {
  const p = clampInt(paragraphs, 1, 200);
  const wpp = clampInt(wordsPerParagraph, 1, 2000);

  const base = mode === "lorem" ? LOREM_WORDS : RANDOM_WORDS;

  const blocks: string[] = [];
  for (let i = 0; i < p; i++) {
    const words = pickWords(base, wpp);
    let para = words.join(" ");
    // Capitalize first letter and add period.
    para = para.charAt(0).toUpperCase() + para.slice(1);
    if (!/[.!?]$/.test(para)) para += ".";
    blocks.push(para);
  }
  return blocks.join("\n\n") + "\n";
}

export function DummyTextGeneratorTool() {
  const [mode, setMode] = useState<Mode>("lorem");
  const [paragraphs, setParagraphs] = useState(3);
  const [wordsPerParagraph, setWordsPerParagraph] = useState(50);

  const output = useMemo(() => generateText(mode, paragraphs, wordsPerParagraph), [mode, paragraphs, wordsPerParagraph]);

  async function copy() {
    await navigator.clipboard.writeText(output);
  }

  function download() {
    downloadTextFile("dummy-text.txt", output);
  }

  function reset() {
    setMode("lorem");
    setParagraphs(3);
    setWordsPerParagraph(50);
  }

  return (
    <div className="grid gap-6">
      {/* Options */}
      <div className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <div className="text-sm font-semibold text-slate-900">Generator</div>

        <div className="grid gap-3 sm:grid-cols-3">
          <label className="grid gap-1 text-sm text-slate-800">
            <span>Type</span>
            <select
              className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"
              value={mode}
              onChange={(e) => setMode(e.target.value as Mode)}
            >
              <option value="lorem">Lorem ipsum</option>
              <option value="random">Random dummy words</option>
            </select>
          </label>

          <label className="grid gap-1 text-sm text-slate-800">
            <span>Paragraphs (1–200)</span>
            <input
              className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm"
              type="number"
              min={1}
              max={200}
              value={paragraphs}
              onChange={(e) => setParagraphs(Number(e.target.value))}
            />
          </label>

          <label className="grid gap-1 text-sm text-slate-800">
            <span>Words per paragraph (1–2000)</span>
            <input
              className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm"
              type="number"
              min={1}
              max={2000}
              value={wordsPerParagraph}
              onChange={(e) => setWordsPerParagraph(Number(e.target.value))}
            />
          </label>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={copy}>Copy</Button>
          <Button type="button" onClick={download}>Download</Button>
          <Button type="button" onClick={reset}>Reset</Button>
        </div>

        <div className="text-xs text-slate-500">
          Output is deterministic (no API calls). Great for placeholders.
        </div>
      </div>

      {/* Output */}
      <div className="grid gap-2">
        <div className="text-sm font-semibold text-slate-900">Output</div>
        <Textarea value={output} readOnly rows={14} />
      </div>
    </div>
  );
}
