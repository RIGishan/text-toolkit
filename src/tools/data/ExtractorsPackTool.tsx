<<<<<<< HEAD
import { useMemo, useState } from "react";
import { Button } from "../../components/ui/Button";
import { Textarea } from "../../components/ui/Textarea";
import { Toggle } from "../../components/ui/Toggle";
import { downloadTextFile } from "../../lib/download";
import { bytesOfUtf8, formatBytes } from "../../lib/text";
import { useDebouncedValue } from "../../lib/useDebouncedValue";

type Mode = "emails" | "urls" | "hashtags" | "phones" | "zip-us" | "dates" | "credit-cards" | "domains";

const WARN_AT = 2 * 1024 * 1024;
const HARD_CAP = 5 * 1024 * 1024;

// Practical extractors (not perfect validators; designed for extraction)
const EMAIL_RE = /[A-Za-z0-9._%+-]+@([A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+)/g; // capture domain
const URL_RE = /\bhttps?:\/\/[^\s"'<>]+/g;
// Unicode hashtag support requires /u
const HASHTAG_RE = /#[\p{L}\p{N}_]+/gu;

// Phone extractor (loose): supports +country, spaces, hyphens, dots, parentheses
// Requires at least ~8 digits total to reduce false positives
const PHONE_RE = /\b(?:\+?\d{1,3}[\s.-]?)?(?:\(?\d{2,4}\)?[\s.-]?)?\d[\d\s().-]{6,}\d\b/g;

// US ZIP
const ZIP_US_RE = /\b\d{5}(?:-\d{4})?\b/g;

// Date extractor (common formats)
// - YYYY-MM-DD, YYYY/MM/DD
// - DD/MM/YYYY, DD-MM-YYYY
// - Month name formats: 13 Feb 2026, Feb 13, 2026
const DATE_RE =
  /\b(?:\d{4}[-/]\d{1,2}[-/]\d{1,2}|\d{1,2}[-/]\d{1,2}[-/]\d{2,4}|\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\s+\d{2,4}|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\s+\d{1,2},?\s+\d{2,4})\b/gi;

// Domain extractor:
// - plain domains like example.com, sub.example.co.uk
// - ignores protocol, path; will also work on pasted domains
const DOMAIN_RE = /\b(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+(?:[a-z]{2,63})\b/gi;

// Card number extractor (loose): 13–19 digits with optional spaces/dashes
const CARD_CANDIDATE_RE = /\b(?:\d[ -]?){13,19}\b/g;

function dedupe(items: string[], caseInsensitive = false): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const it of items) {
    const key = caseInsensitive ? it.toLowerCase() : it;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(it);
  }
  return out;
}

function digitsCount(s: string): number {
  const m = s.match(/\d/g);
  return m ? m.length : 0;
}

function normalizePhone(s: string): string {
  const trimmed = s.trim();
  const plus = trimmed.startsWith("+") ? "+" : "";
  const digits = trimmed.replace(/[^\d]/g, "");
  return plus + digits;
}

function stripUrlToDomain(url: string): string | null {
  try {
    const u = new URL(url);
    return u.hostname || null;
  } catch {
    return null;
  }
}

function luhnCheck(numberDigitsOnly: string): boolean {
  // Luhn algorithm for card validation
  let sum = 0;
  let shouldDouble = false;

  for (let i = numberDigitsOnly.length - 1; i >= 0; i--) {
    let digit = numberDigitsOnly.charCodeAt(i) - 48;
    if (digit < 0 || digit > 9) return false;

    if (shouldDouble) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    shouldDouble = !shouldDouble;
  }

  return sum % 10 === 0;
}

function normalizeCard(candidate: string): string {
  return candidate.replace(/[^\d]/g, "");
}

export function ExtractorsPackTool() {
  const [mode, setMode] = useState<Mode>("emails");
  const [uniqueOnly, setUniqueOnly] = useState(true);
  const [caseInsensitiveUnique, setCaseInsensitiveUnique] = useState(true);

  // Phones: dedupe by normalized digits (recommended)
  const [phoneNormalizeUnique, setPhoneNormalizeUnique] = useState(true);

  // Credit cards: require Luhn check toggle (recommended ON)
  const [requireLuhn, setRequireLuhn] = useState(true);

  const [input, setInput] = useState(
    `Contact: hello@example.com, HELLO@example.com
Website: https://sub.example.co.uk/page?x=1
Domain mention: openai.com
Phone: +1 (505) 123-4567, 505.123.4567
US ZIP: 87101, 87101-1234
Dates: 2026-02-13, 13/02/2026, Feb 13, 2026
Card test: 4111 1111 1111 1111
Hashtags: #TextToolkit #DevTools #DevTools`
  );

  const inputBytes = useMemo(() => bytesOfUtf8(input), [input]);
  const warnLarge = inputBytes > WARN_AT;
  const overCap = inputBytes > HARD_CAP;

  const debouncedInput = useDebouncedValue(input, 180);

  const extracted = useMemo(() => {
    if (!debouncedInput.trim()) {
      return { ok: true as const, items: [] as string[], info: "Paste text to extract." };
    }

    if (overCap) {
      return {
        ok: false as const,
        items: [] as string[],
        error: `Input is ${formatBytes(inputBytes)} which exceeds the 5 MB cap. Reduce size to continue.`
      };
    }

    let items: string[] = [];
    let info = "";

    if (mode === "emails") {
      // Return full emails, not just domain capture
      const matches: string[] = [];
      let m: RegExpExecArray | null;
      const re = new RegExp(EMAIL_RE); // ensures we use the global behavior in exec loop
      // NOTE: EMAIL_RE already has /g, but we re-create to be safe in memo
      const globalEmail = /[A-Za-z0-9._%+-]+@([A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+)/g;

      while ((m = globalEmail.exec(debouncedInput)) !== null) {
        matches.push(m[0]);
        if (m[0].length === 0) globalEmail.lastIndex++;
      }
      items = matches;

      info = "Extracted email-like patterns (not a deliverability validator).";
    } else if (mode === "urls") {
      items = debouncedInput.match(URL_RE) ?? [];
      info = "Extracted http/https URLs.";
    } else if (mode === "hashtags") {
      items = debouncedInput.match(HASHTAG_RE) ?? [];
      info = "Extracted hashtags (Unicode-aware).";
    } else if (mode === "phones") {
      items = (debouncedInput.match(PHONE_RE) ?? []).filter((p) => digitsCount(p) >= 8);
      info = "Extracted phone-like patterns (loose heuristic).";
    } else if (mode === "zip-us") {
      items = debouncedInput.match(ZIP_US_RE) ?? [];
      info = "Extracted US ZIP codes (12345 or 12345-6789).";
    } else if (mode === "dates") {
      items = debouncedInput.match(DATE_RE) ?? [];
      info = "Extracted date-like patterns (common formats).";
    } else if (mode === "credit-cards") {
      const candidates = debouncedInput.match(CARD_CANDIDATE_RE) ?? [];
      const normalized = candidates
        .map((c) => normalizeCard(c))
        .filter((d) => d.length >= 13 && d.length <= 19);

      items = requireLuhn ? normalized.filter(luhnCheck) : normalized;

      info = requireLuhn
        ? "Extracted credit-card-like numbers (Luhn-checked to reduce false positives)."
        : "Extracted credit-card-like numbers (no validation).";
    } else if (mode === "domains") {
      const out: string[] = [];

      // 1) Domains from URLs
      const urls = debouncedInput.match(URL_RE) ?? [];
      for (const u of urls) {
        const d = stripUrlToDomain(u);
        if (d) out.push(d);
      }

      // 2) Domains from emails
      // Extract domain from email matches (simple split)
      const emailMatches = debouncedInput.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+/g) ?? [];
      for (const e of emailMatches) {
        const parts = e.split("@");
        if (parts.length === 2 && parts[1]) out.push(parts[1]);
      }

      // 3) Plain domains mentioned in text
      const domainMentions = debouncedInput.match(DOMAIN_RE) ?? [];
      for (const d of domainMentions) out.push(d);

      // Normalize: lowercase
      items = out.map((d) => d.toLowerCase());

      info = "Extracted domains from URLs, emails, and plain text mentions (heuristic).";
    }

    // Dedupe
    if (uniqueOnly) {
      if (mode === "emails") {
        items = dedupe(items, caseInsensitiveUnique);
      } else if (mode === "phones" && phoneNormalizeUnique) {
        const seen = new Set<string>();
        const out: string[] = [];
        for (const p of items) {
          const key = normalizePhone(p);
          if (seen.has(key)) continue;
          seen.add(key);
          out.push(p.trim());
        }
        items = out;
      } else {
        // domains already lowercased above
        items = dedupe(items, false);
      }
    }

    return { ok: true as const, items, info };
  }, [
    debouncedInput,
    mode,
    uniqueOnly,
    caseInsensitiveUnique,
    phoneNormalizeUnique,
    requireLuhn,
    overCap,
    inputBytes
  ]);

  const outputText = useMemo(() => (extracted.ok ? extracted.items.join("\n") : ""), [extracted]);

  async function copy() {
    if (!outputText) return;
    await navigator.clipboard.writeText(outputText);
  }

  function download() {
    if (!outputText) return;
    const name =
      mode === "emails"
        ? "emails.txt"
        : mode === "urls"
          ? "urls.txt"
          : mode === "hashtags"
            ? "hashtags.txt"
            : mode === "phones"
              ? "phones.txt"
              : mode === "zip-us"
                ? "zip-us.txt"
                : mode === "dates"
                  ? "dates.txt"
                  : mode === "credit-cards"
                    ? "credit-cards.txt"
                    : "domains.txt";

    downloadTextFile(name, outputText);
  }

  function reset() {
    setMode("emails");
    setUniqueOnly(true);
    setCaseInsensitiveUnique(true);
    setPhoneNormalizeUnique(true);
    setRequireLuhn(true);
    setInput(
      `Contact: hello@example.com, HELLO@example.com
Website: https://sub.example.co.uk/page?x=1
Domain mention: openai.com
Phone: +1 (505) 123-4567, 505.123.4567
US ZIP: 87101, 87101-1234
Dates: 2026-02-13, 13/02/2026, Feb 13, 2026
Card test: 4111 1111 1111 1111
Hashtags: #TextToolkit #DevTools #DevTools`
    );
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
          rows={10}
          spellCheck={false}
          placeholder="Paste any text here…"
        />

        {warnLarge && !overCap && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Large input detected (&gt; 2 MB). Extraction may take a moment.
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
            <div className="mt-2 flex flex-wrap gap-2">
              <Button type="button" onClick={() => setMode("emails")} className={mode === "emails" ? "border-blue-500 bg-blue-50" : ""}>
                Emails
              </Button>
              <Button type="button" onClick={() => setMode("urls")} className={mode === "urls" ? "border-blue-500 bg-blue-50" : ""}>
                URLs
              </Button>
              <Button type="button" onClick={() => setMode("hashtags")} className={mode === "hashtags" ? "border-blue-500 bg-blue-50" : ""}>
                Hashtags
              </Button>
              <Button type="button" onClick={() => setMode("phones")} className={mode === "phones" ? "border-blue-500 bg-blue-50" : ""}>
                Phones
              </Button>
              <Button type="button" onClick={() => setMode("zip-us")} className={mode === "zip-us" ? "border-blue-500 bg-blue-50" : ""}>
                ZIP (US)
              </Button>
              <Button type="button" onClick={() => setMode("dates")} className={mode === "dates" ? "border-blue-500 bg-blue-50" : ""}>
                Dates
              </Button>
              <Button type="button" onClick={() => setMode("credit-cards")} className={mode === "credit-cards" ? "border-blue-500 bg-blue-50" : ""}>
                Credit cards
              </Button>
              <Button type="button" onClick={() => setMode("domains")} className={mode === "domains" ? "border-blue-500 bg-blue-50" : ""}>
                Domains
              </Button>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Dedupe</div>
            <div className="mt-2 grid gap-2">
              <Toggle checked={uniqueOnly} onChange={setUniqueOnly} label="Unique only (dedupe)" />
              <Toggle
                checked={caseInsensitiveUnique}
                onChange={setCaseInsensitiveUnique}
                label="Case-insensitive unique (emails only)"
                disabled={!uniqueOnly || mode !== "emails"}
              />
              <Toggle
                checked={phoneNormalizeUnique}
                onChange={setPhoneNormalizeUnique}
                label="Normalize phone numbers for unique (phones only)"
                disabled={!uniqueOnly || mode !== "phones"}
              />
              <Toggle
                checked={requireLuhn}
                onChange={setRequireLuhn}
                label="Require Luhn check (credit cards only)"
                disabled={mode !== "credit-cards"}
              />
              <div className="text-xs text-slate-500">
                These are extractors (heuristics), not strict validators. Credit card mode can Luhn-check to reduce false positives.
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={copy} disabled={!outputText}>
            Copy
          </Button>
          <Button type="button" onClick={download} disabled={!outputText}>
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

        {extracted.ok ? (
          <div className="text-sm text-slate-600">{extracted.info}</div>
        ) : (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
            <div className="font-semibold">Couldn’t process</div>
            <div className="mt-1">{extracted.error}</div>
          </div>
        )}

        <Textarea value={outputText} readOnly rows={10} />
        <div className="text-xs text-slate-500">
          Count: <span className="font-mono">{extracted.ok ? extracted.items.length : 0}</span>
        </div>
      </div>
    </div>
  );
}
=======
import { useMemo, useState } from "react";
import { Button } from "../../components/ui/Button";
import { Textarea } from "../../components/ui/Textarea";
import { Toggle } from "../../components/ui/Toggle";
import { downloadTextFile } from "../../lib/download";
import { bytesOfUtf8, formatBytes } from "../../lib/text";
import { useDebouncedValue } from "../../lib/useDebouncedValue";

type Mode = "emails" | "urls" | "hashtags" | "phones" | "zip-us" | "dates" | "credit-cards" | "domains";

const WARN_AT = 2 * 1024 * 1024;
const HARD_CAP = 5 * 1024 * 1024;

// Practical extractors (not perfect validators; designed for extraction)
const EMAIL_RE = /[A-Za-z0-9._%+-]+@([A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+)/g; // capture domain
const URL_RE = /\bhttps?:\/\/[^\s"'<>]+/g;
// Unicode hashtag support requires /u
const HASHTAG_RE = /#[\p{L}\p{N}_]+/gu;

// Phone extractor (loose): supports +country, spaces, hyphens, dots, parentheses
// Requires at least ~8 digits total to reduce false positives
const PHONE_RE = /\b(?:\+?\d{1,3}[\s.-]?)?(?:\(?\d{2,4}\)?[\s.-]?)?\d[\d\s().-]{6,}\d\b/g;

// US ZIP
const ZIP_US_RE = /\b\d{5}(?:-\d{4})?\b/g;

// Date extractor (common formats)
// - YYYY-MM-DD, YYYY/MM/DD
// - DD/MM/YYYY, DD-MM-YYYY
// - Month name formats: 13 Feb 2026, Feb 13, 2026
const DATE_RE =
  /\b(?:\d{4}[-/]\d{1,2}[-/]\d{1,2}|\d{1,2}[-/]\d{1,2}[-/]\d{2,4}|\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\s+\d{2,4}|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\s+\d{1,2},?\s+\d{2,4})\b/gi;

// Domain extractor:
// - plain domains like example.com, sub.example.co.uk
// - ignores protocol, path; will also work on pasted domains
const DOMAIN_RE = /\b(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+(?:[a-z]{2,63})\b/gi;

// Card number extractor (loose): 13–19 digits with optional spaces/dashes
const CARD_CANDIDATE_RE = /\b(?:\d[ -]?){13,19}\b/g;

function dedupe(items: string[], caseInsensitive = false): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const it of items) {
    const key = caseInsensitive ? it.toLowerCase() : it;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(it);
  }
  return out;
}

function digitsCount(s: string): number {
  const m = s.match(/\d/g);
  return m ? m.length : 0;
}

function normalizePhone(s: string): string {
  const trimmed = s.trim();
  const plus = trimmed.startsWith("+") ? "+" : "";
  const digits = trimmed.replace(/[^\d]/g, "");
  return plus + digits;
}

function stripUrlToDomain(url: string): string | null {
  try {
    const u = new URL(url);
    return u.hostname || null;
  } catch {
    return null;
  }
}

function luhnCheck(numberDigitsOnly: string): boolean {
  // Luhn algorithm for card validation
  let sum = 0;
  let shouldDouble = false;

  for (let i = numberDigitsOnly.length - 1; i >= 0; i--) {
    let digit = numberDigitsOnly.charCodeAt(i) - 48;
    if (digit < 0 || digit > 9) return false;

    if (shouldDouble) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    shouldDouble = !shouldDouble;
  }

  return sum % 10 === 0;
}

function normalizeCard(candidate: string): string {
  return candidate.replace(/[^\d]/g, "");
}

export function ExtractorsPackTool() {
  const [mode, setMode] = useState<Mode>("emails");
  const [uniqueOnly, setUniqueOnly] = useState(true);
  const [caseInsensitiveUnique, setCaseInsensitiveUnique] = useState(true);

  // Phones: dedupe by normalized digits (recommended)
  const [phoneNormalizeUnique, setPhoneNormalizeUnique] = useState(true);

  // Credit cards: require Luhn check toggle (recommended ON)
  const [requireLuhn, setRequireLuhn] = useState(true);

  const [input, setInput] = useState(
    `Contact: hello@example.com, HELLO@example.com
Website: https://sub.example.co.uk/page?x=1
Domain mention: openai.com
Phone: +1 (505) 123-4567, 505.123.4567
US ZIP: 87101, 87101-1234
Dates: 2026-02-13, 13/02/2026, Feb 13, 2026
Card test: 4111 1111 1111 1111
Hashtags: #TextToolkit #DevTools #DevTools`
  );

  const inputBytes = useMemo(() => bytesOfUtf8(input), [input]);
  const warnLarge = inputBytes > WARN_AT;
  const overCap = inputBytes > HARD_CAP;

  const debouncedInput = useDebouncedValue(input, 180);

  const extracted = useMemo(() => {
    if (!debouncedInput.trim()) {
      return { ok: true as const, items: [] as string[], info: "Paste text to extract." };
    }

    if (overCap) {
      return {
        ok: false as const,
        items: [] as string[],
        error: `Input is ${formatBytes(inputBytes)} which exceeds the 5 MB cap. Reduce size to continue.`
      };
    }

    let items: string[] = [];
    let info = "";

    if (mode === "emails") {
      // Return full emails, not just domain capture
      const matches: string[] = [];
      let m: RegExpExecArray | null;
      const re = new RegExp(EMAIL_RE); // ensures we use the global behavior in exec loop
      // NOTE: EMAIL_RE already has /g, but we re-create to be safe in memo
      const globalEmail = /[A-Za-z0-9._%+-]+@([A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+)/g;

      while ((m = globalEmail.exec(debouncedInput)) !== null) {
        matches.push(m[0]);
        if (m[0].length === 0) globalEmail.lastIndex++;
      }
      items = matches;

      info = "Extracted email-like patterns (not a deliverability validator).";
    } else if (mode === "urls") {
      items = debouncedInput.match(URL_RE) ?? [];
      info = "Extracted http/https URLs.";
    } else if (mode === "hashtags") {
      items = debouncedInput.match(HASHTAG_RE) ?? [];
      info = "Extracted hashtags (Unicode-aware).";
    } else if (mode === "phones") {
      items = (debouncedInput.match(PHONE_RE) ?? []).filter((p) => digitsCount(p) >= 8);
      info = "Extracted phone-like patterns (loose heuristic).";
    } else if (mode === "zip-us") {
      items = debouncedInput.match(ZIP_US_RE) ?? [];
      info = "Extracted US ZIP codes (12345 or 12345-6789).";
    } else if (mode === "dates") {
      items = debouncedInput.match(DATE_RE) ?? [];
      info = "Extracted date-like patterns (common formats).";
    } else if (mode === "credit-cards") {
      const candidates = debouncedInput.match(CARD_CANDIDATE_RE) ?? [];
      const normalized = candidates
        .map((c) => normalizeCard(c))
        .filter((d) => d.length >= 13 && d.length <= 19);

      items = requireLuhn ? normalized.filter(luhnCheck) : normalized;

      info = requireLuhn
        ? "Extracted credit-card-like numbers (Luhn-checked to reduce false positives)."
        : "Extracted credit-card-like numbers (no validation).";
    } else if (mode === "domains") {
      const out: string[] = [];

      // 1) Domains from URLs
      const urls = debouncedInput.match(URL_RE) ?? [];
      for (const u of urls) {
        const d = stripUrlToDomain(u);
        if (d) out.push(d);
      }

      // 2) Domains from emails
      // Extract domain from email matches (simple split)
      const emailMatches = debouncedInput.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+/g) ?? [];
      for (const e of emailMatches) {
        const parts = e.split("@");
        if (parts.length === 2 && parts[1]) out.push(parts[1]);
      }

      // 3) Plain domains mentioned in text
      const domainMentions = debouncedInput.match(DOMAIN_RE) ?? [];
      for (const d of domainMentions) out.push(d);

      // Normalize: lowercase
      items = out.map((d) => d.toLowerCase());

      info = "Extracted domains from URLs, emails, and plain text mentions (heuristic).";
    }

    // Dedupe
    if (uniqueOnly) {
      if (mode === "emails") {
        items = dedupe(items, caseInsensitiveUnique);
      } else if (mode === "phones" && phoneNormalizeUnique) {
        const seen = new Set<string>();
        const out: string[] = [];
        for (const p of items) {
          const key = normalizePhone(p);
          if (seen.has(key)) continue;
          seen.add(key);
          out.push(p.trim());
        }
        items = out;
      } else {
        // domains already lowercased above
        items = dedupe(items, false);
      }
    }

    return { ok: true as const, items, info };
  }, [
    debouncedInput,
    mode,
    uniqueOnly,
    caseInsensitiveUnique,
    phoneNormalizeUnique,
    requireLuhn,
    overCap,
    inputBytes
  ]);

  const outputText = useMemo(() => (extracted.ok ? extracted.items.join("\n") : ""), [extracted]);

  async function copy() {
    if (!outputText) return;
    await navigator.clipboard.writeText(outputText);
  }

  function download() {
    if (!outputText) return;
    const name =
      mode === "emails"
        ? "emails.txt"
        : mode === "urls"
          ? "urls.txt"
          : mode === "hashtags"
            ? "hashtags.txt"
            : mode === "phones"
              ? "phones.txt"
              : mode === "zip-us"
                ? "zip-us.txt"
                : mode === "dates"
                  ? "dates.txt"
                  : mode === "credit-cards"
                    ? "credit-cards.txt"
                    : "domains.txt";

    downloadTextFile(name, outputText);
  }

  function reset() {
    setMode("emails");
    setUniqueOnly(true);
    setCaseInsensitiveUnique(true);
    setPhoneNormalizeUnique(true);
    setRequireLuhn(true);
    setInput(
      `Contact: hello@example.com, HELLO@example.com
Website: https://sub.example.co.uk/page?x=1
Domain mention: openai.com
Phone: +1 (505) 123-4567, 505.123.4567
US ZIP: 87101, 87101-1234
Dates: 2026-02-13, 13/02/2026, Feb 13, 2026
Card test: 4111 1111 1111 1111
Hashtags: #TextToolkit #DevTools #DevTools`
    );
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
          rows={10}
          spellCheck={false}
          placeholder="Paste any text here…"
        />

        {warnLarge && !overCap && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Large input detected (&gt; 2 MB). Extraction may take a moment.
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
            <div className="mt-2 flex flex-wrap gap-2">
              <Button type="button" onClick={() => setMode("emails")} className={mode === "emails" ? "border-blue-500 bg-blue-50" : ""}>
                Emails
              </Button>
              <Button type="button" onClick={() => setMode("urls")} className={mode === "urls" ? "border-blue-500 bg-blue-50" : ""}>
                URLs
              </Button>
              <Button type="button" onClick={() => setMode("hashtags")} className={mode === "hashtags" ? "border-blue-500 bg-blue-50" : ""}>
                Hashtags
              </Button>
              <Button type="button" onClick={() => setMode("phones")} className={mode === "phones" ? "border-blue-500 bg-blue-50" : ""}>
                Phones
              </Button>
              <Button type="button" onClick={() => setMode("zip-us")} className={mode === "zip-us" ? "border-blue-500 bg-blue-50" : ""}>
                ZIP (US)
              </Button>
              <Button type="button" onClick={() => setMode("dates")} className={mode === "dates" ? "border-blue-500 bg-blue-50" : ""}>
                Dates
              </Button>
              <Button type="button" onClick={() => setMode("credit-cards")} className={mode === "credit-cards" ? "border-blue-500 bg-blue-50" : ""}>
                Credit cards
              </Button>
              <Button type="button" onClick={() => setMode("domains")} className={mode === "domains" ? "border-blue-500 bg-blue-50" : ""}>
                Domains
              </Button>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Dedupe</div>
            <div className="mt-2 grid gap-2">
              <Toggle checked={uniqueOnly} onChange={setUniqueOnly} label="Unique only (dedupe)" />
              <Toggle
                checked={caseInsensitiveUnique}
                onChange={setCaseInsensitiveUnique}
                label="Case-insensitive unique (emails only)"
                disabled={!uniqueOnly || mode !== "emails"}
              />
              <Toggle
                checked={phoneNormalizeUnique}
                onChange={setPhoneNormalizeUnique}
                label="Normalize phone numbers for unique (phones only)"
                disabled={!uniqueOnly || mode !== "phones"}
              />
              <Toggle
                checked={requireLuhn}
                onChange={setRequireLuhn}
                label="Require Luhn check (credit cards only)"
                disabled={mode !== "credit-cards"}
              />
              <div className="text-xs text-slate-500">
                These are extractors (heuristics), not strict validators. Credit card mode can Luhn-check to reduce false positives.
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={copy} disabled={!outputText}>
            Copy
          </Button>
          <Button type="button" onClick={download} disabled={!outputText}>
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

        {extracted.ok ? (
          <div className="text-sm text-slate-600">{extracted.info}</div>
        ) : (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
            <div className="font-semibold">Couldn’t process</div>
            <div className="mt-1">{extracted.error}</div>
          </div>
        )}

        <Textarea value={outputText} readOnly rows={10} />
        <div className="text-xs text-slate-500">
          Count: <span className="font-mono">{extracted.ok ? extracted.items.length : 0}</span>
        </div>
      </div>
    </div>
  );
}
>>>>>>> a38c6781ba02f0335e4b9de11228d87416afd174
