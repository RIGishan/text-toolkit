<<<<<<< HEAD
import { useMemo, useState } from "react";
import { Button } from "../../components/ui/Button";
import { Textarea } from "../../components/ui/Textarea";
import { downloadTextFile } from "../../lib/download";
import { bytesOfUtf8, formatBytes } from "../../lib/text";
import { useDebouncedValue } from "../../lib/useDebouncedValue";

const HARD_CAP = 5 * 1024 * 1024;
const WARN_AT = 2 * 1024 * 1024;

type DecodeResult =
  | { ok: true; header: unknown; payload: unknown; signature: string; warnings: string[] }
  | { ok: false; error: string; warnings: string[] };

function base64UrlToUint8Array(input: string): Uint8Array {
  // Convert Base64URL → Base64
  let s = input.replace(/-/g, "+").replace(/_/g, "/");
  // Pad
  const pad = s.length % 4;
  if (pad) s += "=".repeat(4 - pad);

  const binary = atob(s);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function decodeBase64UrlUtf8(input: string): string {
  const bytes = base64UrlToUint8Array(input);
  return new TextDecoder().decode(bytes);
}

function safeJsonParse(text: string): { ok: true; value: unknown } | { ok: false; error: string } {
  try {
    return { ok: true, value: JSON.parse(text) as unknown };
  } catch {
    return { ok: false, error: "Not valid JSON." };
  }
}

function prettyJson(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function getExpSeconds(payload: unknown): number | null {
  if (!payload || typeof payload !== "object") return null;
  const v = (payload as Record<string, unknown>)["exp"];
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function formatEpochSeconds(sec: number): string {
  const d = new Date(sec * 1000);
  // Use local time; user can interpret. Keep deterministic format-ish.
  return d.toLocaleString();
}

export function JwtInspectorTool() {
  const [input, setInput] = useState("");
  const inputBytes = useMemo(() => bytesOfUtf8(input), [input]);
  const warnLarge = inputBytes > WARN_AT;
  const overCap = inputBytes > HARD_CAP;

  const debouncedInput = useDebouncedValue(input, 180);

  const decoded = useMemo<DecodeResult>(() => {
    const raw = debouncedInput.trim();
    const warnings: string[] = [];

    if (!raw) {
      return { ok: false, error: "Paste a JWT to decode.", warnings };
    }

    if (overCap) {
      return {
        ok: false,
        error: `Input is ${formatBytes(inputBytes)} which exceeds the 5 MB cap. Reduce size to continue.`,
        warnings
      };
    }

    const parts = raw.split(".");
    if (parts.length !== 3) {
      return {
        ok: false,
        error: "JWT must have exactly 3 dot-separated parts: header.payload.signature",
        warnings
      };
    }

    const [h, p, sig] = parts;

    if (!h || !p) {
      return { ok: false, error: "Header and payload must not be empty.", warnings };
    }

    try {
      const headerText = decodeBase64UrlUtf8(h);
      const payloadText = decodeBase64UrlUtf8(p);

      const headerJson = safeJsonParse(headerText);
      const payloadJson = safeJsonParse(payloadText);

      if (!headerJson.ok) warnings.push("Header is not valid JSON.");
      if (!payloadJson.ok) warnings.push("Payload is not valid JSON.");

      // Even if JSON parse fails, show raw as string.
      const headerVal = headerJson.ok ? headerJson.value : { _raw: headerText };
      const payloadVal = payloadJson.ok ? payloadJson.value : { _raw: payloadText };

      // Security note: never verify signature here
      warnings.push("Note: Signature is not verified (decoder only).");

      return { ok: true, header: headerVal, payload: payloadVal, signature: sig, warnings };
    } catch {
      return { ok: false, error: "Failed to decode Base64URL. Token may be malformed.", warnings };
    }
  }, [debouncedInput, overCap, inputBytes]);

  const expInfo = useMemo(() => {
    if (!decoded.ok) return null;
    const exp = getExpSeconds(decoded.payload);
    if (exp == null) return null;

    const nowSec = Math.floor(Date.now() / 1000);
    const expired = exp <= nowSec;
    const secondsLeft = exp - nowSec;

    return {
      exp,
      expired,
      human: formatEpochSeconds(exp),
      secondsLeft
    };
  }, [decoded]);

  const headerText = useMemo(() => (decoded.ok ? prettyJson(decoded.header) : ""), [decoded]);
  const payloadText = useMemo(() => (decoded.ok ? prettyJson(decoded.payload) : ""), [decoded]);

  async function copy(text: string) {
    if (!text) return;
    await navigator.clipboard.writeText(text);
  }

  function download(name: string, text: string) {
    if (!text) return;
    downloadTextFile(name, text);
  }

  function reset() {
    setInput("");
  }

  return (
    <div className="grid gap-6">
      {/* Input */}
      <div className="grid gap-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm font-semibold text-slate-900">Input JWT</div>
          <div className="text-xs text-slate-500">
            Size: {formatBytes(inputBytes)}
            {warnLarge ? " • Large input detected" : ""}
          </div>
        </div>

        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Paste JWT here (header.payload.signature)…"
          rows={6}
          spellCheck={false}
        />

        {warnLarge && !overCap && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Large input detected (&gt; 2 MB). Decoding may take longer.
          </div>
        )}

        {overCap && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
            Input exceeds 5 MB cap. Reduce input size to continue.
          </div>
        )}
      </div>

      {/* Status / actions */}
      <div className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <div className="text-sm font-semibold text-slate-900">Inspector</div>

        {!decoded.ok ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
            {decoded.error}
          </div>
        ) : (
          <>
            {decoded.warnings.length > 0 && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                <div className="font-semibold">Notes</div>
                <ul className="mt-1 list-disc pl-5">
                  {decoded.warnings.map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              </div>
            )}

            {expInfo && (
              <div
                className={[
                  "rounded-xl border px-4 py-3 text-sm",
                  expInfo.expired
                    ? "border-rose-200 bg-rose-50 text-rose-900"
                    : "border-emerald-200 bg-emerald-50 text-emerald-900"
                ].join(" ")}
              >
                <div className="font-semibold">exp</div>
                <div className="mt-1">
                  {expInfo.human}{" "}
                  {expInfo.expired ? "(expired)" : `(in ${Math.max(0, expInfo.secondsLeft)}s)`}
                </div>
                <div className="mt-1 text-xs opacity-80">Epoch seconds: {expInfo.exp}</div>
              </div>
            )}

            <div className="text-xs text-slate-500">
              Signature shown for reference only. This tool does not verify it.
            </div>
          </>
        )}

        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={reset}>
            Reset
          </Button>
        </div>
      </div>

      {/* Output */}
      <div className="grid gap-6">
        <section className="grid gap-2">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm font-semibold text-slate-900">Header</div>
            <div className="flex gap-2">
              <Button type="button" onClick={() => copy(headerText)} disabled={!headerText}>
                Copy
              </Button>
              <Button type="button" onClick={() => download("jwt.header.json", headerText)} disabled={!headerText}>
                Download
              </Button>
            </div>
          </div>
          <Textarea value={headerText} readOnly rows={8} />
        </section>

        <section className="grid gap-2">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm font-semibold text-slate-900">Payload</div>
            <div className="flex gap-2">
              <Button type="button" onClick={() => copy(payloadText)} disabled={!payloadText}>
                Copy
              </Button>
              <Button type="button" onClick={() => download("jwt.payload.json", payloadText)} disabled={!payloadText}>
                Download
              </Button>
            </div>
          </div>
          <Textarea value={payloadText} readOnly rows={10} />
        </section>

        <section className="grid gap-2">
          <div className="text-sm font-semibold text-slate-900">Signature</div>
          <Textarea value={decoded.ok ? decoded.signature : ""} readOnly rows={3} />
          <div className="text-xs text-slate-500">Plain text only (safe by design).</div>
        </section>
      </div>
    </div>
  );
}
=======
import { useMemo, useState } from "react";
import { Button } from "../../components/ui/Button";
import { Textarea } from "../../components/ui/Textarea";
import { downloadTextFile } from "../../lib/download";
import { bytesOfUtf8, formatBytes } from "../../lib/text";
import { useDebouncedValue } from "../../lib/useDebouncedValue";

const HARD_CAP = 5 * 1024 * 1024;
const WARN_AT = 2 * 1024 * 1024;

type DecodeResult =
  | { ok: true; header: unknown; payload: unknown; signature: string; warnings: string[] }
  | { ok: false; error: string; warnings: string[] };

function base64UrlToUint8Array(input: string): Uint8Array {
  // Convert Base64URL → Base64
  let s = input.replace(/-/g, "+").replace(/_/g, "/");
  // Pad
  const pad = s.length % 4;
  if (pad) s += "=".repeat(4 - pad);

  const binary = atob(s);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function decodeBase64UrlUtf8(input: string): string {
  const bytes = base64UrlToUint8Array(input);
  return new TextDecoder().decode(bytes);
}

function safeJsonParse(text: string): { ok: true; value: unknown } | { ok: false; error: string } {
  try {
    return { ok: true, value: JSON.parse(text) as unknown };
  } catch {
    return { ok: false, error: "Not valid JSON." };
  }
}

function prettyJson(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function getExpSeconds(payload: unknown): number | null {
  if (!payload || typeof payload !== "object") return null;
  const v = (payload as Record<string, unknown>)["exp"];
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function formatEpochSeconds(sec: number): string {
  const d = new Date(sec * 1000);
  // Use local time; user can interpret. Keep deterministic format-ish.
  return d.toLocaleString();
}

export function JwtInspectorTool() {
  const [input, setInput] = useState("");
  const inputBytes = useMemo(() => bytesOfUtf8(input), [input]);
  const warnLarge = inputBytes > WARN_AT;
  const overCap = inputBytes > HARD_CAP;

  const debouncedInput = useDebouncedValue(input, 180);

  const decoded = useMemo<DecodeResult>(() => {
    const raw = debouncedInput.trim();
    const warnings: string[] = [];

    if (!raw) {
      return { ok: false, error: "Paste a JWT to decode.", warnings };
    }

    if (overCap) {
      return {
        ok: false,
        error: `Input is ${formatBytes(inputBytes)} which exceeds the 5 MB cap. Reduce size to continue.`,
        warnings
      };
    }

    const parts = raw.split(".");
    if (parts.length !== 3) {
      return {
        ok: false,
        error: "JWT must have exactly 3 dot-separated parts: header.payload.signature",
        warnings
      };
    }

    const [h, p, sig] = parts;

    if (!h || !p) {
      return { ok: false, error: "Header and payload must not be empty.", warnings };
    }

    try {
      const headerText = decodeBase64UrlUtf8(h);
      const payloadText = decodeBase64UrlUtf8(p);

      const headerJson = safeJsonParse(headerText);
      const payloadJson = safeJsonParse(payloadText);

      if (!headerJson.ok) warnings.push("Header is not valid JSON.");
      if (!payloadJson.ok) warnings.push("Payload is not valid JSON.");

      // Even if JSON parse fails, show raw as string.
      const headerVal = headerJson.ok ? headerJson.value : { _raw: headerText };
      const payloadVal = payloadJson.ok ? payloadJson.value : { _raw: payloadText };

      // Security note: never verify signature here
      warnings.push("Note: Signature is not verified (decoder only).");

      return { ok: true, header: headerVal, payload: payloadVal, signature: sig, warnings };
    } catch {
      return { ok: false, error: "Failed to decode Base64URL. Token may be malformed.", warnings };
    }
  }, [debouncedInput, overCap, inputBytes]);

  const expInfo = useMemo(() => {
    if (!decoded.ok) return null;
    const exp = getExpSeconds(decoded.payload);
    if (exp == null) return null;

    const nowSec = Math.floor(Date.now() / 1000);
    const expired = exp <= nowSec;
    const secondsLeft = exp - nowSec;

    return {
      exp,
      expired,
      human: formatEpochSeconds(exp),
      secondsLeft
    };
  }, [decoded]);

  const headerText = useMemo(() => (decoded.ok ? prettyJson(decoded.header) : ""), [decoded]);
  const payloadText = useMemo(() => (decoded.ok ? prettyJson(decoded.payload) : ""), [decoded]);

  async function copy(text: string) {
    if (!text) return;
    await navigator.clipboard.writeText(text);
  }

  function download(name: string, text: string) {
    if (!text) return;
    downloadTextFile(name, text);
  }

  function reset() {
    setInput("");
  }

  return (
    <div className="grid gap-6">
      {/* Input */}
      <div className="grid gap-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm font-semibold text-slate-900">Input JWT</div>
          <div className="text-xs text-slate-500">
            Size: {formatBytes(inputBytes)}
            {warnLarge ? " • Large input detected" : ""}
          </div>
        </div>

        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Paste JWT here (header.payload.signature)…"
          rows={6}
          spellCheck={false}
        />

        {warnLarge && !overCap && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Large input detected (&gt; 2 MB). Decoding may take longer.
          </div>
        )}

        {overCap && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
            Input exceeds 5 MB cap. Reduce input size to continue.
          </div>
        )}
      </div>

      {/* Status / actions */}
      <div className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <div className="text-sm font-semibold text-slate-900">Inspector</div>

        {!decoded.ok ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
            {decoded.error}
          </div>
        ) : (
          <>
            {decoded.warnings.length > 0 && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                <div className="font-semibold">Notes</div>
                <ul className="mt-1 list-disc pl-5">
                  {decoded.warnings.map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              </div>
            )}

            {expInfo && (
              <div
                className={[
                  "rounded-xl border px-4 py-3 text-sm",
                  expInfo.expired
                    ? "border-rose-200 bg-rose-50 text-rose-900"
                    : "border-emerald-200 bg-emerald-50 text-emerald-900"
                ].join(" ")}
              >
                <div className="font-semibold">exp</div>
                <div className="mt-1">
                  {expInfo.human}{" "}
                  {expInfo.expired ? "(expired)" : `(in ${Math.max(0, expInfo.secondsLeft)}s)`}
                </div>
                <div className="mt-1 text-xs opacity-80">Epoch seconds: {expInfo.exp}</div>
              </div>
            )}

            <div className="text-xs text-slate-500">
              Signature shown for reference only. This tool does not verify it.
            </div>
          </>
        )}

        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={reset}>
            Reset
          </Button>
        </div>
      </div>

      {/* Output */}
      <div className="grid gap-6">
        <section className="grid gap-2">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm font-semibold text-slate-900">Header</div>
            <div className="flex gap-2">
              <Button type="button" onClick={() => copy(headerText)} disabled={!headerText}>
                Copy
              </Button>
              <Button type="button" onClick={() => download("jwt.header.json", headerText)} disabled={!headerText}>
                Download
              </Button>
            </div>
          </div>
          <Textarea value={headerText} readOnly rows={8} />
        </section>

        <section className="grid gap-2">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm font-semibold text-slate-900">Payload</div>
            <div className="flex gap-2">
              <Button type="button" onClick={() => copy(payloadText)} disabled={!payloadText}>
                Copy
              </Button>
              <Button type="button" onClick={() => download("jwt.payload.json", payloadText)} disabled={!payloadText}>
                Download
              </Button>
            </div>
          </div>
          <Textarea value={payloadText} readOnly rows={10} />
        </section>

        <section className="grid gap-2">
          <div className="text-sm font-semibold text-slate-900">Signature</div>
          <Textarea value={decoded.ok ? decoded.signature : ""} readOnly rows={3} />
          <div className="text-xs text-slate-500">Plain text only (safe by design).</div>
        </section>
      </div>
    </div>
  );
}
>>>>>>> a38c6781ba02f0335e4b9de11228d87416afd174
