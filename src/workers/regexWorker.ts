<<<<<<< HEAD
type Req =
  | {
      type: "run";
      pattern: string;
      flags: string;
      text: string;
      maxMatches: number;
    };

type MatchOut = {
  index: number;
  start: number;
  end: number;
  match: string;
  groups: string[];
};

type Res =
  | {
      type: "result";
      ok: true;
      matches: MatchOut[];
      truncated: boolean;
    }
  | {
      type: "result";
      ok: false;
      error: string;
    };

function safeSlice(text: string, start: number, end: number) {
  return text.slice(Math.max(0, start), Math.max(0, end));
}

self.onmessage = (e: MessageEvent<Req>) => {
  const msg = e.data;
  if (msg.type !== "run") return;

  try {
    const { pattern, flags, text, maxMatches } = msg;

    // Construct regex
    const re = new RegExp(pattern, flags);

    const matches: MatchOut[] = [];
    let truncated = false;

    // Use matchAll when global, else exec once
    if (re.global) {
      let m: RegExpExecArray | null;
      let guard = 0;

      while ((m = re.exec(text)) !== null) {
        const start = m.index ?? 0;
        const matchText = m[0] ?? "";
        const end = start + matchText.length;

        matches.push({
          index: matches.length + 1,
          start,
          end,
          match: matchText,
          groups: m.slice(1).map((x) => (x == null ? "" : String(x)))
        });

        // Avoid infinite loops on zero-length matches
        if (matchText.length === 0) re.lastIndex = re.lastIndex + 1;

        if (matches.length >= maxMatches) {
          truncated = true;
          break;
        }

        // Basic runaway guard
        guard++;
        if (guard > 2_000_000) {
          truncated = true;
          break;
        }
      }
    } else {
      const m = re.exec(text);
      if (m) {
        const start = m.index ?? 0;
        const matchText = m[0] ?? "";
        const end = start + matchText.length;
        matches.push({
          index: 1,
          start,
          end,
          match: matchText,
          groups: m.slice(1).map((x) => (x == null ? "" : String(x)))
        });
      }
    }

    // Ensure monotonic / safe bounds
    for (const m of matches) {
      m.match = safeSlice(text, m.start, m.end);
    }

    const res: Res = { type: "result", ok: true, matches, truncated };
    (self as any).postMessage(res);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Regex error.";
    const res: Res = { type: "result", ok: false, error: message };
    (self as any).postMessage(res);
  }
};
=======
type Req =
  | {
      type: "run";
      pattern: string;
      flags: string;
      text: string;
      maxMatches: number;
    };

type MatchOut = {
  index: number;
  start: number;
  end: number;
  match: string;
  groups: string[];
};

type Res =
  | {
      type: "result";
      ok: true;
      matches: MatchOut[];
      truncated: boolean;
    }
  | {
      type: "result";
      ok: false;
      error: string;
    };

function safeSlice(text: string, start: number, end: number) {
  return text.slice(Math.max(0, start), Math.max(0, end));
}

self.onmessage = (e: MessageEvent<Req>) => {
  const msg = e.data;
  if (msg.type !== "run") return;

  try {
    const { pattern, flags, text, maxMatches } = msg;

    // Construct regex
    const re = new RegExp(pattern, flags);

    const matches: MatchOut[] = [];
    let truncated = false;

    // Use matchAll when global, else exec once
    if (re.global) {
      let m: RegExpExecArray | null;
      let guard = 0;

      while ((m = re.exec(text)) !== null) {
        const start = m.index ?? 0;
        const matchText = m[0] ?? "";
        const end = start + matchText.length;

        matches.push({
          index: matches.length + 1,
          start,
          end,
          match: matchText,
          groups: m.slice(1).map((x) => (x == null ? "" : String(x)))
        });

        // Avoid infinite loops on zero-length matches
        if (matchText.length === 0) re.lastIndex = re.lastIndex + 1;

        if (matches.length >= maxMatches) {
          truncated = true;
          break;
        }

        // Basic runaway guard
        guard++;
        if (guard > 2_000_000) {
          truncated = true;
          break;
        }
      }
    } else {
      const m = re.exec(text);
      if (m) {
        const start = m.index ?? 0;
        const matchText = m[0] ?? "";
        const end = start + matchText.length;
        matches.push({
          index: 1,
          start,
          end,
          match: matchText,
          groups: m.slice(1).map((x) => (x == null ? "" : String(x)))
        });
      }
    }

    // Ensure monotonic / safe bounds
    for (const m of matches) {
      m.match = safeSlice(text, m.start, m.end);
    }

    const res: Res = { type: "result", ok: true, matches, truncated };
    (self as any).postMessage(res);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Regex error.";
    const res: Res = { type: "result", ok: false, error: message };
    (self as any).postMessage(res);
  }
};
>>>>>>> a38c6781ba02f0335e4b9de11228d87416afd174
