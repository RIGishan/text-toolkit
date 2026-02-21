export {};

type Mode = "csv-to-json" | "json-to-csv";

type Req =
  | {
      type: "convert";
      mode: Mode;
      input: string;
      delimiter: string | "auto";
      hasHeader: boolean;
      prettyJson: boolean;
    };

type Res =
  | {
      type: "result";
      ok: true;
      output: string;
      info: string;
    }
  | {
      type: "result";
      ok: false;
      error: string;
    };

function detectDelimiter(text: string): string {
  // check first few lines
  const sample = text.split(/\r?\n/).slice(0, 10).join("\n");

  const candidates = [",", "\t", ";", "|"];
  let best = ",";
  let bestScore = -1;

  for (const c of candidates) {
    const count = sample.split(c).length - 1;
    if (count > bestScore) {
      bestScore = count;
      best = c;
    }
  }

  return best;
}

function parseCsv(text: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (ch === '"') {
      if (inQuotes && text[i + 1] === '"') {
        // escaped quote
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (!inQuotes && ch === delimiter) {
      row.push(current);
      current = "";
      continue;
    }

    if (!inQuotes && (ch === "\n" || ch === "\r")) {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(current);
      rows.push(row);
      row = [];
      current = "";
      continue;
    }

    current += ch;
  }

  row.push(current);
  rows.push(row);

  // Remove trailing empty last line if file ends with newline
  if (rows.length > 0) {
    const last = rows[rows.length - 1];
    if (last.length === 1 && last[0].trim() === "") rows.pop();
  }

  return rows;
}

function escapeCsvValue(value: unknown, delimiter: string): string {
  const s = value == null ? "" : String(value);

  const mustQuote =
    s.includes('"') || s.includes("\n") || s.includes("\r") || s.includes(delimiter);

  if (!mustQuote) return s;

  return `"${s.replace(/"/g, '""')}"`;
}

function csvToJson(input: string, delimiter: string, hasHeader: boolean, pretty: boolean) {
  const rows = parseCsv(input, delimiter);
  if (rows.length === 0) return "[]";

  if (hasHeader) {
    const header = rows[0];
    const data = rows.slice(1).map((r) => {
      const obj: Record<string, string> = {};
      for (let i = 0; i < header.length; i++) {
        const key = header[i] || `col_${i + 1}`;
        obj[key] = r[i] ?? "";
      }
      return obj;
    });

    return JSON.stringify(data, null, pretty ? 2 : 0);
  }

  // no header: return arrays
  return JSON.stringify(rows, null, pretty ? 2 : 0);
}

function jsonToCsv(input: string, delimiter: string, hasHeader: boolean) {
  let data: any;
  try {
    data = JSON.parse(input);
  } catch {
    throw new Error("Invalid JSON input.");
  }

  if (!Array.isArray(data)) {
    throw new Error("JSON must be an array (of objects or arrays).");
  }

  if (data.length === 0) {
    return "";
  }

  // Array of objects
  if (typeof data[0] === "object" && data[0] !== null && !Array.isArray(data[0])) {
    const keys = Array.from(
      new Set(data.flatMap((row: Record<string, any>) => Object.keys(row)))
    );

    const lines: string[] = [];

    if (hasHeader) {
      lines.push(keys.map((k) => escapeCsvValue(k, delimiter)).join(delimiter));
    }

    for (const row of data) {
      lines.push(
        keys.map((k) => escapeCsvValue(row?.[k] ?? "", delimiter)).join(delimiter)
      );
    }

    return lines.join("\n");
  }

  // Array of arrays
  if (Array.isArray(data[0])) {
    const lines: string[] = [];
    for (const row of data) {
      if (!Array.isArray(row)) throw new Error("Mixed array types found.");
      lines.push(row.map((v) => escapeCsvValue(v, delimiter)).join(delimiter));
    }
    return lines.join("\n");
  }

  throw new Error("Unsupported JSON structure.");
}

self.onmessage = (e: MessageEvent<Req>) => {
  const msg = e.data;
  if (msg.type !== "convert") return;

  try {
    const { mode, input, delimiter, hasHeader, prettyJson } = msg;

    if (!input.trim()) {
      const res: Res = { type: "result", ok: true, output: "", info: "No input provided." };
      (self as any).postMessage(res);
      return;
    }

    const usedDelimiter = delimiter === "auto" ? detectDelimiter(input) : delimiter;

    let output = "";
    let info = "";

    if (mode === "csv-to-json") {
      output = csvToJson(input, usedDelimiter, hasHeader, prettyJson);
      info = `Converted CSV → JSON (delimiter: ${usedDelimiter === "\t" ? "TAB" : usedDelimiter})`;
    } else {
      output = jsonToCsv(input, usedDelimiter, hasHeader);
      info = `Converted JSON → CSV (delimiter: ${usedDelimiter === "\t" ? "TAB" : usedDelimiter})`;
    }

    const res: Res = { type: "result", ok: true, output, info };
    (self as any).postMessage(res);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Conversion failed.";
    const res: Res = { type: "result", ok: false, error: msg };
    (self as any).postMessage(res);
  }
};
