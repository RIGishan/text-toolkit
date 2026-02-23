<<<<<<< HEAD
type Style = "bold" | "italic" | "boldItalic" | "monospace" | "doubleStruck" | "script" | "smallCaps";

const A = "A".charCodeAt(0);
const Z = "Z".charCodeAt(0);
const a = "a".charCodeAt(0);
const z = "z".charCodeAt(0);
const zero = "0".charCodeAt(0);
const nine = "9".charCodeAt(0);

function mapRange(charCode: number, start: number, end: number, base: number): string | null {
  if (charCode < start || charCode > end) return null;
  return String.fromCodePoint(base + (charCode - start));
}

// Unicode math alphabets blocks (most platforms support these)
const BASES = {
  bold: {
    upper: 0x1d400,
    lower: 0x1d41a,
    digit: 0x1d7ce
  },
  italic: {
    upper: 0x1d434,
    lower: 0x1d44e
  },
  boldItalic: {
    upper: 0x1d468,
    lower: 0x1d482
  },
  monospace: {
    upper: 0x1d670,
    lower: 0x1d68a,
    digit: 0x1d7f6
  },
  doubleStruck: {
    upper: 0x1d538,
    lower: 0x1d552,
    digit: 0x1d7d8
  },
  script: {
    upper: 0x1d49c,
    lower: 0x1d4b6
  }
} as const;

// Some script letters are missing in Unicode block; fallback replacements:
const SCRIPT_EXCEPTIONS: Record<string, string> = {
  B: "ℬ",
  E: "ℰ",
  F: "ℱ",
  H: "ℋ",
  I: "ℐ",
  L: "ℒ",
  M: "ℳ",
  R: "ℛ",
  e: "ℯ",
  g: "ℊ",
  o: "ℴ"
};

// Small caps is not a contiguous block, so we map manually:
const SMALL_CAPS_MAP: Record<string, string> = {
  a: "ᴀ",
  b: "ʙ",
  c: "ᴄ",
  d: "ᴅ",
  e: "ᴇ",
  f: "ꜰ",
  g: "ɢ",
  h: "ʜ",
  i: "ɪ",
  j: "ᴊ",
  k: "ᴋ",
  l: "ʟ",
  m: "ᴍ",
  n: "ɴ",
  o: "ᴏ",
  p: "ᴘ",
  q: "ǫ",
  r: "ʀ",
  s: "ꜱ",
  t: "ᴛ",
  u: "ᴜ",
  v: "ᴠ",
  w: "ᴡ",
  x: "x",
  y: "ʏ",
  z: "ᴢ"
};

export function unicodeTransform(input: string, style: Style): string {
  if (!input) return "";

  if (style === "smallCaps") {
    return Array.from(input).map((ch) => SMALL_CAPS_MAP[ch.toLowerCase()] ?? ch).join("");
  }

  return Array.from(input)
    .map((ch) => {
      const code = ch.charCodeAt(0);

      // digits
      if (code >= zero && code <= nine) {
        const digitBase = (BASES as any)[style]?.digit;
        if (digitBase) return mapRange(code, zero, nine, digitBase) ?? ch;
        return ch;
      }

      // uppercase
      if (code >= A && code <= Z) {
        if (style === "script" && SCRIPT_EXCEPTIONS[ch]) return SCRIPT_EXCEPTIONS[ch];
        const base = (BASES as any)[style]?.upper;
        if (base) return mapRange(code, A, Z, base) ?? ch;
        return ch;
      }

      // lowercase
      if (code >= a && code <= z) {
        if (style === "script" && SCRIPT_EXCEPTIONS[ch]) return SCRIPT_EXCEPTIONS[ch];
        const base = (BASES as any)[style]?.lower;
        if (base) return mapRange(code, a, z, base) ?? ch;
        return ch;
      }

      return ch;
    })
    .join("");
=======
type Style = "bold" | "italic" | "boldItalic" | "monospace" | "doubleStruck" | "script" | "smallCaps";

const A = "A".charCodeAt(0);
const Z = "Z".charCodeAt(0);
const a = "a".charCodeAt(0);
const z = "z".charCodeAt(0);
const zero = "0".charCodeAt(0);
const nine = "9".charCodeAt(0);

function mapRange(charCode: number, start: number, end: number, base: number): string | null {
  if (charCode < start || charCode > end) return null;
  return String.fromCodePoint(base + (charCode - start));
}

// Unicode math alphabets blocks (most platforms support these)
const BASES = {
  bold: {
    upper: 0x1d400,
    lower: 0x1d41a,
    digit: 0x1d7ce
  },
  italic: {
    upper: 0x1d434,
    lower: 0x1d44e
  },
  boldItalic: {
    upper: 0x1d468,
    lower: 0x1d482
  },
  monospace: {
    upper: 0x1d670,
    lower: 0x1d68a,
    digit: 0x1d7f6
  },
  doubleStruck: {
    upper: 0x1d538,
    lower: 0x1d552,
    digit: 0x1d7d8
  },
  script: {
    upper: 0x1d49c,
    lower: 0x1d4b6
  }
} as const;

// Some script letters are missing in Unicode block; fallback replacements:
const SCRIPT_EXCEPTIONS: Record<string, string> = {
  B: "ℬ",
  E: "ℰ",
  F: "ℱ",
  H: "ℋ",
  I: "ℐ",
  L: "ℒ",
  M: "ℳ",
  R: "ℛ",
  e: "ℯ",
  g: "ℊ",
  o: "ℴ"
};

// Small caps is not a contiguous block, so we map manually:
const SMALL_CAPS_MAP: Record<string, string> = {
  a: "ᴀ",
  b: "ʙ",
  c: "ᴄ",
  d: "ᴅ",
  e: "ᴇ",
  f: "ꜰ",
  g: "ɢ",
  h: "ʜ",
  i: "ɪ",
  j: "ᴊ",
  k: "ᴋ",
  l: "ʟ",
  m: "ᴍ",
  n: "ɴ",
  o: "ᴏ",
  p: "ᴘ",
  q: "ǫ",
  r: "ʀ",
  s: "ꜱ",
  t: "ᴛ",
  u: "ᴜ",
  v: "ᴠ",
  w: "ᴡ",
  x: "x",
  y: "ʏ",
  z: "ᴢ"
};

export function unicodeTransform(input: string, style: Style): string {
  if (!input) return "";

  if (style === "smallCaps") {
    return Array.from(input).map((ch) => SMALL_CAPS_MAP[ch.toLowerCase()] ?? ch).join("");
  }

  return Array.from(input)
    .map((ch) => {
      const code = ch.charCodeAt(0);

      // digits
      if (code >= zero && code <= nine) {
        const digitBase = (BASES as any)[style]?.digit;
        if (digitBase) return mapRange(code, zero, nine, digitBase) ?? ch;
        return ch;
      }

      // uppercase
      if (code >= A && code <= Z) {
        if (style === "script" && SCRIPT_EXCEPTIONS[ch]) return SCRIPT_EXCEPTIONS[ch];
        const base = (BASES as any)[style]?.upper;
        if (base) return mapRange(code, A, Z, base) ?? ch;
        return ch;
      }

      // lowercase
      if (code >= a && code <= z) {
        if (style === "script" && SCRIPT_EXCEPTIONS[ch]) return SCRIPT_EXCEPTIONS[ch];
        const base = (BASES as any)[style]?.lower;
        if (base) return mapRange(code, a, z, base) ?? ch;
        return ch;
      }

      return ch;
    })
    .join("");
>>>>>>> a38c6781ba02f0335e4b9de11228d87416afd174
}