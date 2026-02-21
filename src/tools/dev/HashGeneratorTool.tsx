import { useMemo, useState } from "react";
import { Button } from "../../components/ui/Button";
import { Textarea } from "../../components/ui/Textarea";
import { Toggle } from "../../components/ui/Toggle";
import { downloadTextFile } from "../../lib/download";
import { bytesOfUtf8, formatBytes } from "../../lib/text";
import { useDebouncedValue } from "../../lib/useDebouncedValue";

type Algo = "SHA-256" | "SHA-512";

const HARD_CAP = 5 * 1024 * 1024;
const WARN_AT = 2 * 1024 * 1024;

function bytesToHex(bytes: ArrayBuffer): string {
  const arr = new Uint8Array(bytes);
  let out = "";
  for (const b of arr) out += b.toString(16).padStart(2, "0");
  return out;
}

async function hashText(algo: Algo, text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest(algo, data);
  return bytesToHex(digest);
}

function normalizeHex(input: string): string {
  return input.trim().replace(/\s+/g, "").toLowerCase();
}

function expectedHexLength(algo: Algo): number {
  return algo === "SHA-256" ? 64 : 128;
}

export function HashGeneratorTool() {
  const [input, setInput] = useState("");
  const [algo, setAlgo] = useState<Algo>("SHA-256");
  const [uppercase, setUppercase] = useState(false);

  // NEW: verification field
  const [expectedHash, setExpectedHash] = useState("");

  const inputBytes = useMemo(() => bytesOfUtf8(input), [input]);
  const warnLarge = inputBytes > WARN_AT;
  const overCap = inputBytes > HARD_CAP;

  const debouncedInput = useDebouncedValue(input, 250);

  const [output, setOutput] = useState("");
  const [status, setStatus] = useState<
    { type: "idle" | "ok" | "error" | "processing"; message: string }
  >({ type: "idle", message: "Enter text to hash." });

  useMemo(() => {
    let cancelled = false;

    async function run() {
      const text = debouncedInput;

      if (!text.trim()) {
        setOutput("");
        setStatus({ type: "idle", message: "Enter text to hash." });
        return;
      }

      if (overCap) {
        setOutput("");
        setStatus({
          type: "error",
          message: `Input is ${formatBytes(inputBytes)} which exceeds the 5 MB cap. Reduce size to continue.`
        });
        return;
      }

      setStatus({ type: "processing", message: "Processing…" });

      try {
        const digest = await hashText(algo, text);
        if (cancelled) return;

        const finalOut = uppercase ? digest.toUpperCase() : digest.toLowerCase();
        setOutput(finalOut);
        setStatus({ type: "ok", message: "Hash generated successfully." });
      } catch {
        if (cancelled) return;
        setOutput("");
        setStatus({ type: "error", message: "Failed to generate hash." });
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [debouncedInput, algo, uppercase, overCap, inputBytes]);

  // NEW: verification computation (no extra hashing, uses existing output)
  const verification = useMemo(() => {
    const exp = normalizeHex(expectedHash);
    const out = normalizeHex(output);

    if (!exp) return { state: "empty" as const, message: "Paste a hash here to verify." };
    if (!out) return { state: "empty" as const, message: "Generate a hash first." };

    const len = expectedHexLength(algo);

    if (!/^[0-9a-f]+$/.test(exp)) {
      return { state: "invalid" as const, message: "Expected hash must be hex (0-9, a-f)." };
    }
    if (exp.length !== len) {
      return {
        state: "invalid" as const,
        message: `Expected hash length must be ${len} hex characters for ${algo}.`
      };
    }

    if (exp === out) return { state: "match" as const, message: "✅ Match: the text produces this hash." };
    return { state: "nomatch" as const, message: "❌ No match: the text does not produce this hash." };
  }, [expectedHash, output, algo]);

  async function onCopy() {
    if (!output) return;
    await navigator.clipboard.writeText(output);
  }

  function onDownload() {
    if (!output) return;
    downloadTextFile(algo === "SHA-256" ? "sha256.txt" : "sha512.txt", output);
  }

  function onReset() {
    setInput("");
    setAlgo("SHA-256");
    setUppercase(false);
    setExpectedHash("");
    setOutput("");
    setStatus({ type: "idle", message: "Enter text to hash." });
  }

  return (
    <div className="grid gap-6">
      {/* Input */}
      <div className="grid gap-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm font-semibold text-slate-900">Input</div>
          <div className="text-xs text-slate-500">
            Size: {formatBytes(inputBytes)}
            {warnLarge ? " • Large input detected" : ""}
          </div>
        </div>

        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Enter text to hash…"
          rows={8}
          spellCheck={false}
        />

        {warnLarge && !overCap && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Large input detected (&gt; 2 MB). Hashing may take a moment.
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
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Algorithm
            </div>
            <div className="mt-2 flex gap-2">
              <Button
                type="button"
                onClick={() => setAlgo("SHA-256")}
                className={algo === "SHA-256" ? "border-blue-500 bg-blue-50" : ""}
              >
                SHA-256
              </Button>
              <Button
                type="button"
                onClick={() => setAlgo("SHA-512")}
                className={algo === "SHA-512" ? "border-blue-500 bg-blue-50" : ""}
              >
                SHA-512
              </Button>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Output
            </div>
            <div className="mt-2">
              <Toggle checked={uppercase} onChange={setUppercase} label="Uppercase hex output" />
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={onCopy} disabled={!output}>
            Copy
          </Button>
          <Button type="button" onClick={onDownload} disabled={!output}>
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

        {status.type === "processing" && (
          <div className="text-sm text-slate-600">{status.message}</div>
        )}

        {status.type === "ok" && (
          <div className="text-sm text-emerald-700">{status.message}</div>
        )}

        {status.type === "error" && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
            {status.message}
          </div>
        )}

        <Textarea value={output} readOnly rows={4} />
        <div className="text-xs text-slate-500">Output is plain text only (safe by design).</div>
      </div>

      {/* NEW: Verify */}
      <div className="grid gap-2 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="text-sm font-semibold text-slate-900">Verify hash</div>
        <div className="text-xs text-slate-500">
          Paste a known hash to check whether the current input produces the same value.
        </div>

        <Textarea
          value={expectedHash}
          onChange={(e) => setExpectedHash(e.target.value)}
          placeholder={`Paste expected ${algo} hash here…`}
          rows={3}
          spellCheck={false}
        />

        {verification.state === "match" && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
            {verification.message}
          </div>
        )}

        {verification.state === "nomatch" && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
            {verification.message}
          </div>
        )}

        {verification.state === "invalid" && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            {verification.message}
          </div>
        )}

        {verification.state === "empty" && (
          <div className="text-sm text-slate-600">{verification.message}</div>
        )}
      </div>
    </div>
  );
}
