import { useMemo, useState } from "react";
import { Button } from "../../components/ui/Button";
import { Textarea } from "../../components/ui/Textarea";
import { Toggle } from "../../components/ui/Toggle";
import { downloadTextFile } from "../../lib/download";

type Kind = "uuid" | "nanoid";

const MAX_BULK = 1000;
const DEFAULT_NANO_LEN = 21;

// URL-safe NanoID alphabet (same spirit as nanoid default, no external lib)
const NANO_ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz-";

function clampInt(n: number, min: number, max: number) {
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, Math.floor(n)));
}

function randomBytes(len: number): Uint8Array {
  const out = new Uint8Array(len);
  crypto.getRandomValues(out);
  return out;
}

function toHex(byte: number) {
  return byte.toString(16).padStart(2, "0");
}

// RFC 4122 UUID v4 using crypto.getRandomValues
function uuidV4(): string {
  const b = randomBytes(16);

  // Version 4
  b[6] = (b[6] & 0x0f) | 0x40;
  // Variant 10xxxxxx
  b[8] = (b[8] & 0x3f) | 0x80;

  const hex = Array.from(b, toHex).join("");
  return (
    hex.slice(0, 8) +
    "-" +
    hex.slice(8, 12) +
    "-" +
    hex.slice(12, 16) +
    "-" +
    hex.slice(16, 20) +
    "-" +
    hex.slice(20)
  );
}

// NanoID-like generator (URL-safe) without external dependency
function nanoId(len: number): string {
  const alphabet = NANO_ALPHABET;
  const mask = 63; // 0..63 (alphabet length 64)
  const step = Math.ceil((len * 1.6)); // small overshoot

  let id = "";
  while (id.length < len) {
    const bytes = randomBytes(step);
    for (let i = 0; i < bytes.length && id.length < len; i++) {
      const idx = bytes[i] & mask; // fast because alphabet is 64 chars
      id += alphabet[idx];
    }
  }
  return id;
}

export function IdGeneratorTool() {
  const [kind, setKind] = useState<Kind>("uuid");
  const [count, setCount] = useState<number>(1);

  // UUID options
  const [uuidUppercase, setUuidUppercase] = useState(false);

  // Nano options
  const [nanoLength, setNanoLength] = useState<number>(DEFAULT_NANO_LEN);

  const [items, setItems] = useState<string[]>([]);

  const normalizedCount = useMemo(() => clampInt(count, 1, MAX_BULK), [count]);
  const normalizedNanoLen = useMemo(() => clampInt(nanoLength, 4, 128), [nanoLength]);

  const output = useMemo(() => items.join("\n"), [items]);

  function generate() {
    const n = normalizedCount;

    const list: string[] = [];
    if (kind === "uuid") {
      for (let i = 0; i < n; i++) {
        const v = uuidV4();
        list.push(uuidUppercase ? v.toUpperCase() : v.toLowerCase());
      }
    } else {
      for (let i = 0; i < n; i++) list.push(nanoId(normalizedNanoLen));
    }

    setItems(list);
  }

  async function copyAll() {
    if (!output) return;
    await navigator.clipboard.writeText(output);
  }

  async function copyFirst() {
    const first = items[0];
    if (!first) return;
    await navigator.clipboard.writeText(first);
  }

  function download() {
    if (!output) return;
    downloadTextFile(kind === "uuid" ? "uuids.txt" : "nanoids.txt", output);
  }

  function reset() {
    setKind("uuid");
    setCount(1);
    setUuidUppercase(false);
    setNanoLength(DEFAULT_NANO_LEN);
    setItems([]);
  }

  return (
    <div className="grid gap-6">
      {/* Input (minimal for generator tools) */}
      <div className="grid gap-2">
        <div className="text-sm font-semibold text-slate-900">Input</div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
          This tool generates IDs locally in your browser. No input required.
        </div>
      </div>

      {/* Options */}
      <div className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <div className="text-sm font-semibold text-slate-900">Options</div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-white p-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Type</div>
            <div className="mt-2 flex gap-2">
              <Button
                type="button"
                onClick={() => setKind("uuid")}
                className={kind === "uuid" ? "border-blue-500 bg-blue-50" : ""}
              >
                UUID v4
              </Button>
              <Button
                type="button"
                onClick={() => setKind("nanoid")}
                className={kind === "nanoid" ? "border-blue-500 bg-blue-50" : ""}
              >
                NanoID
              </Button>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Bulk</div>
            <div className="mt-2 grid gap-2">
              <label className="text-sm text-slate-800">
                Count (1–{MAX_BULK})
              </label>
              <input
                className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm"
                type="number"
                inputMode="numeric"
                min={1}
                max={MAX_BULK}
                value={count}
                onChange={(e) => setCount(Number(e.target.value))}
              />
              <div className="text-xs text-slate-500">
                Large counts generate quickly, but keep it reasonable for copy/paste.
              </div>
            </div>
          </div>
        </div>

        {kind === "uuid" ? (
          <div className="rounded-xl border border-slate-200 bg-white p-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              UUID formatting
            </div>
            <div className="mt-2">
              <Toggle
                checked={uuidUppercase}
                onChange={setUuidUppercase}
                label="Uppercase"
              />
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-slate-200 bg-white p-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              NanoID settings
            </div>
            <div className="mt-2 grid gap-2">
              <label className="text-sm text-slate-800">Length (4–128)</label>
              <input
                className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm"
                type="number"
                inputMode="numeric"
                min={4}
                max={128}
                value={nanoLength}
                onChange={(e) => setNanoLength(Number(e.target.value))}
              />
              <div className="text-xs text-slate-500">
                Uses URL-safe characters only: <span className="font-mono">A–Z a–z 0–9 _ -</span>
              </div>
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={generate}>
            Generate
          </Button>
          <Button type="button" onClick={copyFirst} disabled={!items[0]}>
            Copy first
          </Button>
          <Button type="button" onClick={copyAll} disabled={!output}>
            Copy all
          </Button>
          <Button type="button" onClick={download} disabled={!output}>
            Download
          </Button>
          <Button type="button" onClick={reset}>
            Reset
          </Button>
        </div>
      </div>

      {/* Output */}
      <div className="grid gap-2">
        <div className="text-sm font-semibold text-slate-900">Output</div>
        <Textarea value={output} readOnly rows={10} aria-label="Generated IDs output" />
        <div className="text-xs text-slate-500">Output is plain text only (safe by design).</div>
      </div>
    </div>
  );
}
