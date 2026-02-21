import { useMemo, useState } from "react";
import { Button } from "../../components/ui/Button";
import { Textarea } from "../../components/ui/Textarea";
import { Toggle } from "../../components/ui/Toggle";
import { downloadTextFile } from "../../lib/download";
import { bytesOfUtf8, formatBytes } from "../../lib/text";
import { useDebouncedValue } from "../../lib/useDebouncedValue";

type Mode = "encode" | "decode";

const HARD_CAP = 5 * 1024 * 1024;
const WARN_AT = 2 * 1024 * 1024;

function isLikelyBase64(input: string): { ok: boolean; reason?: string } {
  const s = input.trim();
  if (!s) return { ok: false, reason: "Empty input." };

  // Allow "data:*;base64,XXXX"
  const dataUrlMatch = s.match(/^data:([^;,]+)?(;charset=[^;,]+)?;base64,(.*)$/i);
  const body = dataUrlMatch ? dataUrlMatch[3] : s;

  // Remove whitespace
  const cleaned = body.replace(/\s+/g, "");
  if (cleaned.length === 0) return { ok: false, reason: "No Base64 content found." };

  // base64 length usually multiple of 4 (padding rules), but sometimes unpadded is seen in wild.
  // We'll allow unpadded but still validate charset.
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(cleaned)) {
    return { ok: false, reason: "Contains characters outside Base64 alphabet." };
  }

  // If padding exists, length must be multiple of 4
  if (cleaned.includes("=") && cleaned.length % 4 !== 0) {
    return { ok: false, reason: "Padding present but length is not a multiple of 4." };
  }

  return { ok: true };
}

function stripDataUrlIfPresent(input: string): { mime: string | null; base64: string } {
  const s = input.trim();
  const m = s.match(/^data:([^;,]+)?(;charset=[^;,]+)?;base64,(.*)$/i);
  if (!m) return { mime: null, base64: s };
  const mime = m[1] ? m[1].trim() : "application/octet-stream";
  return { mime, base64: m[3] ?? "" };
}

// UTF-8 safe Base64 encode/decode helpers
function toBase64Utf8(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  // Chunk to avoid call stack / performance issues
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

function fromBase64Utf8(base64: string): string {
  const cleaned = base64.replace(/\s+/g, "");
  const binary = atob(cleaned);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

export function Base64Tool() {
  const [mode, setMode] = useState<Mode>("encode");
  const [input, setInput] = useState("");
  const [wrapDataUrl, setWrapDataUrl] = useState(false);
  const [dataUrlMime, setDataUrlMime] = useState("text/plain");

  const inputBytes = useMemo(() => bytesOfUtf8(input), [input]);
  const warnLarge = inputBytes > WARN_AT;
  const overCap = inputBytes > HARD_CAP;

  const debouncedInput = useDebouncedValue(input, 180);

  const result = useMemo(() => {
    if (!debouncedInput.trim()) {
      return { ok: true as const, output: "", info: "Enter text (encode) or Base64 (decode)." };
    }
    if (overCap) {
      return {
        ok: false as const,
        output: "",
        error: `Input is ${formatBytes(inputBytes)} which exceeds the 5 MB cap. Reduce size to continue.`
      };
    }

    try {
      if (mode === "encode") {
        const encoded = toBase64Utf8(debouncedInput);
        const output = wrapDataUrl
          ? `data:${dataUrlMime || "text/plain"};base64,${encoded}`
          : encoded;

        return { ok: true as const, output, info: "Encoded successfully." };
      } else {
        const { mime, base64 } = stripDataUrlIfPresent(debouncedInput);
        const validation = isLikelyBase64(debouncedInput);
        if (!validation.ok) {
          return {
            ok: false as const,
            output: "",
            error: `Invalid Base64: ${validation.reason ?? "Malformed input."}`
          };
        }

        const decoded = fromBase64Utf8(base64);
        const info = mime ? `Decoded successfully (Data URL: ${mime}).` : "Decoded successfully.";
        return { ok: true as const, output: decoded, info };
      }
    } catch {
      // Keep errors friendly; no stack traces in UI
      return {
        ok: false as const,
        output: "",
        error:
          mode === "encode"
            ? "Could not encode this input."
            : "Could not decode this Base64 (check padding/characters)."
      };
    }
  }, [debouncedInput, mode, wrapDataUrl, dataUrlMime, overCap, inputBytes]);

  const canCopyDownload = result.ok && result.output.length > 0;

  async function onCopy() {
    if (!canCopyDownload) return;
    await navigator.clipboard.writeText(result.output);
  }

  function onDownload() {
    if (!canCopyDownload) return;
    downloadTextFile(
      mode === "encode" ? "base64.txt" : "decoded.txt",
      result.output
    );
  }

  function onReset() {
    setMode("encode");
    setInput("");
    setWrapDataUrl(false);
    setDataUrlMime("text/plain");
  }

  return (
    <div className="grid gap-6">
      {/* Input */}
      <div className="grid gap-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm font-semibold text-slate-900">Input</div>
          <div className="text-xs text-slate-500">
            Size: {formatBytes(inputBytes)}
            {warnLarge ? " • Large input: may take longer" : ""}
          </div>
        </div>

        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={
            mode === "encode"
              ? "Enter text to encode as Base64…"
              : "Paste Base64 (or a data:...;base64,...) to decode…"
          }
          rows={8}
          spellCheck={false}
        />

        {warnLarge && !overCap && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Large input detected (&gt; 2 MB). This tool stays responsive, but processing may take a moment.
          </div>
        )}

        {overCap && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
            Input exceeds 5 MB cap. Reduce input size to continue.
          </div>
        )}
      </div>

      {/* Options */}
      <div className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <div className="text-sm font-semibold text-slate-900">Options</div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-white p-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Mode</div>
            <div className="mt-2 flex gap-2">
              <Button
                type="button"
                onClick={() => setMode("encode")}
                className={mode === "encode" ? "border-blue-500 bg-blue-50" : ""}
              >
                Encode
              </Button>
              <Button
                type="button"
                onClick={() => setMode("decode")}
                className={mode === "decode" ? "border-blue-500 bg-blue-50" : ""}
              >
                Decode
              </Button>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Data URL</div>
            <div className="mt-2 grid gap-2">
              <Toggle
                checked={wrapDataUrl}
                onChange={setWrapDataUrl}
                label="Wrap encoded output as Data URL"
                disabled={overCap || mode !== "encode"}
              />
              <input
                className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm disabled:opacity-60"
                value={dataUrlMime}
                onChange={(e) => setDataUrlMime(e.target.value)}
                placeholder="MIME type (e.g. text/plain)"
                disabled={overCap || mode !== "encode" || !wrapDataUrl}
              />
              <div className="text-xs text-slate-500">
                This is for convenience only. No files are uploaded anywhere.
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={onCopy} disabled={!canCopyDownload}>
            Copy
          </Button>
          <Button type="button" onClick={onDownload} disabled={!canCopyDownload}>
            Download
          </Button>
          <Button type="button" onClick={onReset}>
            Reset
          </Button>
        </div>
      </div>

      {/* Output */}
      <div className="grid gap-2">
        <div className="text-sm font-semibold text-slate-900">Output</div>

        {result.ok ? (
          <div className="text-sm text-emerald-700">{result.info}</div>
        ) : (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
            <div className="font-semibold">Couldn’t process</div>
            <div className="mt-1">{result.error}</div>
          </div>
        )}

        <Textarea value={result.ok ? result.output : ""} readOnly rows={8} />
        <div className="text-xs text-slate-500">Output is plain text only (safe by design).</div>
      </div>
    </div>
  );
}
