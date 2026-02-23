<<<<<<< HEAD
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "../../components/ui/Button";
import { Textarea } from "../../components/ui/Textarea";
import { Toggle } from "../../components/ui/Toggle";
import { bytesOfUtf8, formatBytes } from "../../lib/text";
import { useDebouncedValue } from "../../lib/useDebouncedValue";
import { REGEX_LIBRARY, escapeForRegexLiteral, normalizeFlags, unescapeCommon } from "../../lib/regex";

type MatchOut = {
  index: number;
  start: number;
  end: number;
  match: string;
  groups: string[];
};

type WorkerOk = { type: "result"; ok: true; matches: MatchOut[]; truncated: boolean };
type WorkerErr = { type: "result"; ok: false; error: string };
type WorkerRes = WorkerOk | WorkerErr;

const WARN_AT = 2 * 1024 * 1024;
const HARD_CAP = 5 * 1024 * 1024;

const MAX_MATCHES = 2000; // safety for UI rendering

export function RegexSuiteTool() {
  const [pattern, setPattern] = useState(String.raw`(\w+)`);
  const [flags, setFlags] = useState("g");
  const [text, setText] = useState("Paste text here to test your regex.\nTry: hello world");

  const [showHighlight, setShowHighlight] = useState(true);

  const textBytes = useMemo(() => bytesOfUtf8(text), [text]);
  const warnLarge = textBytes > WARN_AT;
  const overCap = textBytes > HARD_CAP;

  const debouncedPattern = useDebouncedValue(pattern, 150);
  const debouncedFlags = useDebouncedValue(flags, 150);
  const debouncedText = useDebouncedValue(text, 180);

  const workerRef = useRef<Worker | null>(null);
  const reqIdRef = useRef(0);

  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [matches, setMatches] = useState<MatchOut[]>([]);
  const [truncated, setTruncated] = useState(false);

  useEffect(() => {
    const w = new Worker(new URL("../../workers/regexWorker.ts", import.meta.url), { type: "module" });
    workerRef.current = w;

    w.onmessage = (e: MessageEvent<WorkerRes>) => {
      const msg = e.data;
      setProcessing(false);

      if (!msg.ok) {
        setError(msg.error || "Regex error.");
        setMatches([]);
        setTruncated(false);
        return;
      }

      setError(null);
      setMatches(msg.matches);
      setTruncated(msg.truncated);
    };

    return () => {
      w.terminate();
      workerRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (overCap) {
      setError(`Input is ${formatBytes(textBytes)} which exceeds the 5 MB cap. Reduce text to continue.`);
      setMatches([]);
      setTruncated(false);
      setProcessing(false);
      return;
    }

    const p = debouncedPattern.trim();
    if (!p) {
      setError("Enter a regex pattern.");
      setMatches([]);
      setTruncated(false);
      return;
    }

    const f = normalizeFlags(debouncedFlags);
    setProcessing(true);
    reqIdRef.current += 1;

    workerRef.current?.postMessage({
      type: "run",
      pattern: p,
      flags: f,
      text: debouncedText,
      maxMatches: MAX_MATCHES
    });
  }, [debouncedPattern, debouncedFlags, debouncedText, overCap, textBytes]);

  function onInsertLibrary(itemIndex: number) {
    const item = REGEX_LIBRARY[itemIndex];
    if (!item) return;
    setPattern(item.pattern);
    setFlags(item.flags);
  }

  function escapeSelectionOrAll() {
    // Simple approach: escape entire pattern field content (useful for building literals)
    setPattern(escapeForRegexLiteral(pattern));
  }

  function unescapePattern() {
    setPattern(unescapeCommon(pattern));
  }

  function reset() {
    setPattern(String.raw`(\w+)`);
    setFlags("g");
    setText("Paste text here to test your regex.\nTry: hello world");
    setShowHighlight(true);
  }

  const highlightNodes = useMemo(() => {
    if (!showHighlight) return null;
    if (error) return null;
    if (matches.length === 0) return [<span key="t0">{debouncedText}</span>];

    // Build segments as React nodes (NO HTML strings)
    const nodes: React.ReactNode[] = [];
    let cursor = 0;

    // Ensure sorted, non-overlapping display (worker should already be ordered)
    const safeMatches = matches
      .filter((m) => m.start <= m.end && m.start >= 0 && m.end <= debouncedText.length)
      .sort((a, b) => a.start - b.start);

    for (let i = 0; i < safeMatches.length; i++) {
      const m = safeMatches[i];

      // If overlapping, skip later overlaps to keep UI sane
      if (m.start < cursor) continue;

      if (cursor < m.start) {
        nodes.push(<span key={`t-${cursor}`}>{debouncedText.slice(cursor, m.start)}</span>);
      }

      nodes.push(
        <mark
          key={`m-${m.start}-${m.end}`}
          className="rounded-md bg-amber-200 px-0.5 text-slate-900"
        >
          {debouncedText.slice(m.start, m.end)}
        </mark>
      );

      cursor = m.end;
      if (nodes.length > 5000) break; // safety
    }

    if (cursor < debouncedText.length) {
      nodes.push(<span key={`t-end`}>{debouncedText.slice(cursor)}</span>);
    }

    return nodes;
  }, [showHighlight, error, matches, debouncedText]);

  return (
    <div className="grid gap-6">
      {/* Pattern / flags */}
      <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="text-sm font-semibold text-slate-900">Pattern</div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="grid gap-2">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Regex</div>
            <input
              className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm"
              value={pattern}
              onChange={(e) => setPattern(e.target.value)}
              placeholder="e.g. (\\w+)"
              spellCheck={false}
            />
            <div className="flex flex-wrap gap-2">
              <Button type="button" onClick={escapeSelectionOrAll}>
                Escape
              </Button>
              <Button type="button" onClick={unescapePattern}>
                Unescape
              </Button>
            </div>
            <div className="text-xs text-slate-500">
              Escape is helpful when turning literal text into a safe regex pattern.
            </div>
          </div>

          <div className="grid gap-2">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Flags</div>
            <input
              className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm"
              value={flags}
              onChange={(e) => setFlags(e.target.value)}
              placeholder="gimsuyd"
              spellCheck={false}
            />
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
              Allowed flags: <span className="font-mono">g i m s u y d</span> (duplicates removed).
            </div>
            <Toggle checked={showHighlight} onChange={setShowHighlight} label="Highlight matches" />
          </div>
        </div>

        <div className="grid gap-2">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Library</div>
          <div className="flex flex-wrap gap-2">
            {REGEX_LIBRARY.map((item, idx) => (
              <Button key={item.name} type="button" onClick={() => onInsertLibrary(idx)}>
                {item.name}
              </Button>
            ))}
          </div>
          <div className="text-xs text-slate-500">
            These are common patterns. Always verify for your exact use case.
          </div>
        </div>
      </div>

      {/* Test text */}
      <div className="grid gap-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm font-semibold text-slate-900">Test text</div>
          <div className="text-xs text-slate-500">
            Size: {formatBytes(textBytes)}
            {warnLarge ? " • Large input detected" : ""}
          </div>
        </div>

        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={10}
          placeholder="Paste or type text…"
          spellCheck={false}
        />

        {warnLarge && !overCap && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Large input detected (&gt; 2 MB). Matching runs in a worker, UI stays responsive.
          </div>
        )}

        {overCap && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
            Input exceeds 5 MB cap. Reduce input size to continue.
          </div>
        )}
      </div>

      {/* Output: status + highlight + matches */}
      <div className="grid gap-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm font-semibold text-slate-900">Results</div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={reset}>
              Reset
            </Button>
          </div>
        </div>

        {processing && (
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
            Processing…
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
            <div className="font-semibold">Regex error</div>
            <div className="mt-1">{error}</div>
          </div>
        )}

        {!error && (
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Highlight preview (plain text only)
            </div>
            <pre className="mt-2 max-h-[320px] overflow-auto whitespace-pre-wrap break-words rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-900">
              {highlightNodes}
            </pre>
            <div className="mt-2 text-xs text-slate-500">
              Matches: <span className="font-mono">{matches.length}</span>
              {truncated ? " • Truncated (too many matches)" : ""}
            </div>
          </div>
        )}

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Match list</div>

          {matches.length === 0 ? (
            <div className="mt-2 text-sm text-slate-600">No matches.</div>
          ) : (
            <div className="mt-3 overflow-auto rounded-xl border border-slate-200">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3">#</th>
                    <th className="px-4 py-3">Range</th>
                    <th className="px-4 py-3">Match</th>
                    <th className="px-4 py-3">Groups</th>
                  </tr>
                </thead>
                <tbody>
                  {matches.slice(0, 200).map((m) => (
                    <tr key={`${m.start}-${m.end}-${m.index}`} className="border-b border-slate-100">
                      <td className="px-4 py-3 font-mono">{m.index}</td>
                      <td className="px-4 py-3 font-mono">
                        {m.start}–{m.end}
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-mono">{m.match}</span>
                      </td>
                      <td className="px-4 py-3">
                        {m.groups.length === 0 ? (
                          <span className="text-slate-500">—</span>
                        ) : (
                          <div className="grid gap-1">
                            {m.groups.map((g, idx) => (
                              <div key={idx} className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 font-mono">
                                {idx + 1}: {g}
                              </div>
                            ))}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {matches.length > 200 && (
            <div className="mt-2 text-xs text-slate-500">
              Showing first 200 matches for UI performance.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
=======
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "../../components/ui/Button";
import { Textarea } from "../../components/ui/Textarea";
import { Toggle } from "../../components/ui/Toggle";
import { bytesOfUtf8, formatBytes } from "../../lib/text";
import { useDebouncedValue } from "../../lib/useDebouncedValue";
import { REGEX_LIBRARY, escapeForRegexLiteral, normalizeFlags, unescapeCommon } from "../../lib/regex";

type MatchOut = {
  index: number;
  start: number;
  end: number;
  match: string;
  groups: string[];
};

type WorkerOk = { type: "result"; ok: true; matches: MatchOut[]; truncated: boolean };
type WorkerErr = { type: "result"; ok: false; error: string };
type WorkerRes = WorkerOk | WorkerErr;

const WARN_AT = 2 * 1024 * 1024;
const HARD_CAP = 5 * 1024 * 1024;

const MAX_MATCHES = 2000; // safety for UI rendering

export function RegexSuiteTool() {
  const [pattern, setPattern] = useState(String.raw`(\w+)`);
  const [flags, setFlags] = useState("g");
  const [text, setText] = useState("Paste text here to test your regex.\nTry: hello world");

  const [showHighlight, setShowHighlight] = useState(true);

  const textBytes = useMemo(() => bytesOfUtf8(text), [text]);
  const warnLarge = textBytes > WARN_AT;
  const overCap = textBytes > HARD_CAP;

  const debouncedPattern = useDebouncedValue(pattern, 150);
  const debouncedFlags = useDebouncedValue(flags, 150);
  const debouncedText = useDebouncedValue(text, 180);

  const workerRef = useRef<Worker | null>(null);
  const reqIdRef = useRef(0);

  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [matches, setMatches] = useState<MatchOut[]>([]);
  const [truncated, setTruncated] = useState(false);

  useEffect(() => {
    const w = new Worker(new URL("../../workers/regexWorker.ts", import.meta.url), { type: "module" });
    workerRef.current = w;

    w.onmessage = (e: MessageEvent<WorkerRes>) => {
      const msg = e.data;
      setProcessing(false);

      if (!msg.ok) {
        setError(msg.error || "Regex error.");
        setMatches([]);
        setTruncated(false);
        return;
      }

      setError(null);
      setMatches(msg.matches);
      setTruncated(msg.truncated);
    };

    return () => {
      w.terminate();
      workerRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (overCap) {
      setError(`Input is ${formatBytes(textBytes)} which exceeds the 5 MB cap. Reduce text to continue.`);
      setMatches([]);
      setTruncated(false);
      setProcessing(false);
      return;
    }

    const p = debouncedPattern.trim();
    if (!p) {
      setError("Enter a regex pattern.");
      setMatches([]);
      setTruncated(false);
      return;
    }

    const f = normalizeFlags(debouncedFlags);
    setProcessing(true);
    reqIdRef.current += 1;

    workerRef.current?.postMessage({
      type: "run",
      pattern: p,
      flags: f,
      text: debouncedText,
      maxMatches: MAX_MATCHES
    });
  }, [debouncedPattern, debouncedFlags, debouncedText, overCap, textBytes]);

  function onInsertLibrary(itemIndex: number) {
    const item = REGEX_LIBRARY[itemIndex];
    if (!item) return;
    setPattern(item.pattern);
    setFlags(item.flags);
  }

  function escapeSelectionOrAll() {
    // Simple approach: escape entire pattern field content (useful for building literals)
    setPattern(escapeForRegexLiteral(pattern));
  }

  function unescapePattern() {
    setPattern(unescapeCommon(pattern));
  }

  function reset() {
    setPattern(String.raw`(\w+)`);
    setFlags("g");
    setText("Paste text here to test your regex.\nTry: hello world");
    setShowHighlight(true);
  }

  const highlightNodes = useMemo(() => {
    if (!showHighlight) return null;
    if (error) return null;
    if (matches.length === 0) return [<span key="t0">{debouncedText}</span>];

    // Build segments as React nodes (NO HTML strings)
    const nodes: React.ReactNode[] = [];
    let cursor = 0;

    // Ensure sorted, non-overlapping display (worker should already be ordered)
    const safeMatches = matches
      .filter((m) => m.start <= m.end && m.start >= 0 && m.end <= debouncedText.length)
      .sort((a, b) => a.start - b.start);

    for (let i = 0; i < safeMatches.length; i++) {
      const m = safeMatches[i];

      // If overlapping, skip later overlaps to keep UI sane
      if (m.start < cursor) continue;

      if (cursor < m.start) {
        nodes.push(<span key={`t-${cursor}`}>{debouncedText.slice(cursor, m.start)}</span>);
      }

      nodes.push(
        <mark
          key={`m-${m.start}-${m.end}`}
          className="rounded-md bg-amber-200 px-0.5 text-slate-900"
        >
          {debouncedText.slice(m.start, m.end)}
        </mark>
      );

      cursor = m.end;
      if (nodes.length > 5000) break; // safety
    }

    if (cursor < debouncedText.length) {
      nodes.push(<span key={`t-end`}>{debouncedText.slice(cursor)}</span>);
    }

    return nodes;
  }, [showHighlight, error, matches, debouncedText]);

  return (
    <div className="grid gap-6">
      {/* Pattern / flags */}
      <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="text-sm font-semibold text-slate-900">Pattern</div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="grid gap-2">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Regex</div>
            <input
              className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm"
              value={pattern}
              onChange={(e) => setPattern(e.target.value)}
              placeholder="e.g. (\\w+)"
              spellCheck={false}
            />
            <div className="flex flex-wrap gap-2">
              <Button type="button" onClick={escapeSelectionOrAll}>
                Escape
              </Button>
              <Button type="button" onClick={unescapePattern}>
                Unescape
              </Button>
            </div>
            <div className="text-xs text-slate-500">
              Escape is helpful when turning literal text into a safe regex pattern.
            </div>
          </div>

          <div className="grid gap-2">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Flags</div>
            <input
              className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm"
              value={flags}
              onChange={(e) => setFlags(e.target.value)}
              placeholder="gimsuyd"
              spellCheck={false}
            />
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
              Allowed flags: <span className="font-mono">g i m s u y d</span> (duplicates removed).
            </div>
            <Toggle checked={showHighlight} onChange={setShowHighlight} label="Highlight matches" />
          </div>
        </div>

        <div className="grid gap-2">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Library</div>
          <div className="flex flex-wrap gap-2">
            {REGEX_LIBRARY.map((item, idx) => (
              <Button key={item.name} type="button" onClick={() => onInsertLibrary(idx)}>
                {item.name}
              </Button>
            ))}
          </div>
          <div className="text-xs text-slate-500">
            These are common patterns. Always verify for your exact use case.
          </div>
        </div>
      </div>

      {/* Test text */}
      <div className="grid gap-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm font-semibold text-slate-900">Test text</div>
          <div className="text-xs text-slate-500">
            Size: {formatBytes(textBytes)}
            {warnLarge ? " • Large input detected" : ""}
          </div>
        </div>

        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={10}
          placeholder="Paste or type text…"
          spellCheck={false}
        />

        {warnLarge && !overCap && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Large input detected (&gt; 2 MB). Matching runs in a worker, UI stays responsive.
          </div>
        )}

        {overCap && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
            Input exceeds 5 MB cap. Reduce input size to continue.
          </div>
        )}
      </div>

      {/* Output: status + highlight + matches */}
      <div className="grid gap-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm font-semibold text-slate-900">Results</div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={reset}>
              Reset
            </Button>
          </div>
        </div>

        {processing && (
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
            Processing…
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
            <div className="font-semibold">Regex error</div>
            <div className="mt-1">{error}</div>
          </div>
        )}

        {!error && (
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Highlight preview (plain text only)
            </div>
            <pre className="mt-2 max-h-[320px] overflow-auto whitespace-pre-wrap break-words rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-900">
              {highlightNodes}
            </pre>
            <div className="mt-2 text-xs text-slate-500">
              Matches: <span className="font-mono">{matches.length}</span>
              {truncated ? " • Truncated (too many matches)" : ""}
            </div>
          </div>
        )}

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Match list</div>

          {matches.length === 0 ? (
            <div className="mt-2 text-sm text-slate-600">No matches.</div>
          ) : (
            <div className="mt-3 overflow-auto rounded-xl border border-slate-200">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3">#</th>
                    <th className="px-4 py-3">Range</th>
                    <th className="px-4 py-3">Match</th>
                    <th className="px-4 py-3">Groups</th>
                  </tr>
                </thead>
                <tbody>
                  {matches.slice(0, 200).map((m) => (
                    <tr key={`${m.start}-${m.end}-${m.index}`} className="border-b border-slate-100">
                      <td className="px-4 py-3 font-mono">{m.index}</td>
                      <td className="px-4 py-3 font-mono">
                        {m.start}–{m.end}
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-mono">{m.match}</span>
                      </td>
                      <td className="px-4 py-3">
                        {m.groups.length === 0 ? (
                          <span className="text-slate-500">—</span>
                        ) : (
                          <div className="grid gap-1">
                            {m.groups.map((g, idx) => (
                              <div key={idx} className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 font-mono">
                                {idx + 1}: {g}
                              </div>
                            ))}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {matches.length > 200 && (
            <div className="mt-2 text-xs text-slate-500">
              Showing first 200 matches for UI performance.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
>>>>>>> a38c6781ba02f0335e4b9de11228d87416afd174
