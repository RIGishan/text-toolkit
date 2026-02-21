import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "../../components/ui/Button";
import { Textarea } from "../../components/ui/Textarea";
import { Toggle } from "../../components/ui/Toggle";
import { downloadTextFile } from "../../lib/download";
import { bytesOfUtf8, formatBytes } from "../../lib/text";
import { useDebouncedValue } from "../../lib/useDebouncedValue";

type Mode = "csv-to-json" | "json-to-csv";
type Delim = "auto" | "," | "\t" | ";" | "|";

type WorkerOk = { type: "result"; ok: true; output: string; info: string };
type WorkerErr = { type: "result"; ok: false; error: string };
type WorkerRes = WorkerOk | WorkerErr;

const WARN_AT = 2 * 1024 * 1024;
const HARD_CAP = 5 * 1024 * 1024;

export function CsvJsonConverterTool() {
  const [mode, setMode] = useState<Mode>("csv-to-json");
  const [delimiter, setDelimiter] = useState<Delim>("auto");
  const [hasHeader, setHasHeader] = useState(true);
  const [prettyJson, setPrettyJson] = useState(true);

  const [input, setInput] = useState(
    "name,age,city\nJesse,25,Albuquerque\nWalter,50,Albuquerque"
  );

  const inputBytes = useMemo(() => bytesOfUtf8(input), [input]);
  const warnLarge = inputBytes > WARN_AT;
  const overCap = inputBytes > HARD_CAP;

  const debouncedInput = useDebouncedValue(input, 200);

  const workerRef = useRef<Worker | null>(null);

  const [processing, setProcessing] = useState(false);
  const [output, setOutput] = useState("");
  const [info, setInfo] = useState("Enter input to convert.");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const w = new Worker(new URL("../../workers/csvWorker.ts", import.meta.url), { type: "module" });
    workerRef.current = w;

    w.onmessage = (e: MessageEvent<WorkerRes>) => {
      setProcessing(false);

      const msg = e.data;
      if (!msg.ok) {
        setError(msg.error);
        setOutput("");
        setInfo("");
        return;
      }

      setError(null);
      setOutput(msg.output);
      setInfo(msg.info);
    };

    return () => {
      w.terminate();
      workerRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (overCap) {
      setProcessing(false);
      setError(`Input is ${formatBytes(inputBytes)} which exceeds the 5 MB cap. Reduce size to continue.`);
      setOutput("");
      setInfo("");
      return;
    }

    setProcessing(true);

    workerRef.current?.postMessage({
      type: "convert",
      mode,
      input: debouncedInput,
      delimiter,
      hasHeader,
      prettyJson
    });
  }, [mode, delimiter, hasHeader, prettyJson, debouncedInput, overCap, inputBytes]);

  async function copyOutput() {
    if (!output) return;
    await navigator.clipboard.writeText(output);
  }

  function downloadOutput() {
    if (!output) return;
    downloadTextFile(mode === "csv-to-json" ? "output.json" : "output.csv", output);
  }

  function reset() {
    setMode("csv-to-json");
    setDelimiter("auto");
    setHasHeader(true);
    setPrettyJson(true);
    setInput("name,age,city\nJesse,25,Albuquerque\nWalter,50,Albuquerque");
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
          placeholder="Paste CSV/TSV or JSON here…"
        />

        {warnLarge && !overCap && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Large input detected (&gt; 2 MB). Conversion runs in a worker.
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
                onClick={() => setMode("csv-to-json")}
                className={mode === "csv-to-json" ? "border-blue-500 bg-blue-50" : ""}
              >
                CSV → JSON
              </Button>
              <Button
                type="button"
                onClick={() => setMode("json-to-csv")}
                className={mode === "json-to-csv" ? "border-blue-500 bg-blue-50" : ""}
              >
                JSON → CSV
              </Button>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Delimiter
            </div>
            <select
              className="mt-2 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm"
              value={delimiter}
              onChange={(e) => setDelimiter(e.target.value as Delim)}
            >
              <option value="auto">Auto detect</option>
              <option value=",">Comma (,)</option>
              <option value="\t">Tab (TSV)</option>
              <option value=";">Semicolon (;)</option>
              <option value="|">Pipe (|)</option>
            </select>

            <div className="mt-2 text-xs text-slate-500">
              Auto detect checks the first few lines.
            </div>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-white p-3">
            <Toggle checked={hasHeader} onChange={setHasHeader} label="Header row" />
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-3">
            <Toggle
              checked={prettyJson}
              onChange={setPrettyJson}
              label="Pretty JSON output"
              disabled={mode !== "csv-to-json"}
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={copyOutput} disabled={!output}>
            Copy
          </Button>
          <Button type="button" onClick={downloadOutput} disabled={!output}>
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

        {processing && (
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
            Processing…
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
            <div className="font-semibold">Conversion error</div>
            <div className="mt-1">{error}</div>
          </div>
        )}

        {!error && (
          <div className="text-sm text-slate-600">{info}</div>
        )}

        <Textarea value={output} readOnly rows={12} />
        <div className="text-xs text-slate-500">Output is plain text only (safe by design).</div>
      </div>
    </div>
  );
}
