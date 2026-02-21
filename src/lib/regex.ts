export type RegexLibraryItem = {
  name: string;
  pattern: string;
  flags: string;
  note?: string;
};

export const REGEX_LIBRARY: RegexLibraryItem[] = [
  { name: "Email", pattern: String.raw`[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}`, flags: "g" },
  { name: "URL (http/https)", pattern: String.raw`https?:\/\/[^\s"']+`, flags: "g" },
  { name: "Phone (loose)", pattern: String.raw`\+?\d[\d\s().-]{7,}\d`, flags: "g" },
  { name: "Hashtag", pattern: String.raw`#[\p{L}\p{N}_]+`, flags: "gu" },
  { name: "IPv4", pattern: String.raw`\b(?:(?:25[0-5]|2[0-4]\d|[01]?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d?\d)\b`, flags: "g" },
  { name: "Hex Color", pattern: String.raw`#(?:[0-9a-fA-F]{3}){1,2}\b`, flags: "g" }
];

export function escapeForRegexLiteral(text: string): string {
  // Escape characters with special regex meaning
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function unescapeCommon(text: string): string {
  // Small helper: interpret common escape sequences (not full JS parser)
  return text
    .replace(/\\\\/g, "\\")
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "\r")
    .replace(/\\t/g, "\t");
}

export function normalizeFlags(flags: string): string {
  // Allow only known flags; remove duplicates
  const allowed = new Set(["g", "i", "m", "s", "u", "y", "d"]);
  const out: string[] = [];
  for (const ch of flags) {
    if (allowed.has(ch) && !out.includes(ch)) out.push(ch);
  }
  return out.join("");
}
