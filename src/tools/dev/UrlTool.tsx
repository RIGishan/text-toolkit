<<<<<<< HEAD
import { useMemo, useState } from "react";
import { Button } from "../../components/ui/Button";
import { Textarea } from "../../components/ui/Textarea";
import { Toggle } from "../../components/ui/Toggle";
import { downloadTextFile } from "../../lib/download";
import { bytesOfUtf8, formatBytes } from "../../lib/text";
import { useDebouncedValue } from "../../lib/useDebouncedValue";

type QueryParam = {
  key: string;
  value: string;
  enabled: boolean;
};

function safeDecodeURIComponent(value: string): string {
  try {
    return decodeURIComponent(value.replace(/\+/g, " "));
  } catch {
    return value;
  }
}

function safeEncodeURIComponent(value: string): string {
  try {
    return encodeURIComponent(value);
  } catch {
    return value;
  }
}

function parseUrlOrQuery(input: string): {
  baseUrl: string;
  params: QueryParam[];
  hashPart: string;
} {
  const trimmed = input.trim();
  if (!trimmed) return { baseUrl: "", params: [], hashPart: "" };

  let baseUrl = trimmed;
  let queryString = "";
  let hashPart = "";

  // Extract hash
  const hashIndex = baseUrl.indexOf("#");
  if (hashIndex >= 0) {
    hashPart = baseUrl.slice(hashIndex);
    baseUrl = baseUrl.slice(0, hashIndex);
  }

  // Extract query
  const qIndex = baseUrl.indexOf("?");
  if (qIndex >= 0) {
    queryString = baseUrl.slice(qIndex + 1);
    baseUrl = baseUrl.slice(0, qIndex);
  } else {
    // If input looks like query only
    if (trimmed.includes("=") && !trimmed.startsWith("http")) {
      queryString = trimmed;
      baseUrl = "";
    }
  }

  const params: QueryParam[] = [];

  if (queryString.trim()) {
    for (const part of queryString.split("&")) {
      if (!part.trim()) continue;

      const [rawKey, rawValue = ""] = part.split("=");
      const key = safeDecodeURIComponent(rawKey);
      const value = safeDecodeURIComponent(rawValue);

      params.push({
        key,
        value,
        enabled: true
      });
    }
  }

  return { baseUrl, params, hashPart };
}

function buildQueryString(params: QueryParam[], encode: boolean): string {
  const active = params.filter((p) => p.enabled && p.key.trim() !== "");

  return active
    .map((p) => {
      const k = encode ? safeEncodeURIComponent(p.key) : p.key;
      const v = encode ? safeEncodeURIComponent(p.value) : p.value;
      return `${k}=${v}`;
    })
    .join("&");
}

export function UrlTool() {
  const [input, setInput] = useState("");
  const [encodeOutput, setEncodeOutput] = useState(true);

  // UTM fields
  const [utmSource, setUtmSource] = useState("");
  const [utmMedium, setUtmMedium] = useState("");
  const [utmCampaign, setUtmCampaign] = useState("");
  const [utmTerm, setUtmTerm] = useState("");
  const [utmContent, setUtmContent] = useState("");

  const inputBytes = useMemo(() => bytesOfUtf8(input), [input]);
  const warnLarge = inputBytes > 2 * 1024 * 1024;
  const hardCap = 5 * 1024 * 1024;
  const overCap = inputBytes > hardCap;

  const debouncedInput = useDebouncedValue(input, 200);

  const parsed = useMemo(() => {
    if (!debouncedInput.trim()) {
      return { baseUrl: "", params: [] as QueryParam[], hashPart: "" };
    }
    return parseUrlOrQuery(debouncedInput);
  }, [debouncedInput]);

  const [params, setParams] = useState<QueryParam[]>([]);

  // Sync params when input changes
  useMemo(() => {
    setParams(parsed.params);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parsed.baseUrl, parsed.hashPart, debouncedInput]);

  const rebuiltUrl = useMemo(() => {
    if (overCap) return "";

    const query = buildQueryString(params, encodeOutput);

    if (!parsed.baseUrl && query) return query;

    const full =
      parsed.baseUrl +
      (query ? `?${query}` : "") +
      (parsed.hashPart || "");

    return full.trim();
  }, [params, parsed.baseUrl, parsed.hashPart, encodeOutput, overCap]);

  const decodedPreview = useMemo(() => {
    if (!rebuiltUrl.trim()) return "";
    return safeDecodeURIComponent(rebuiltUrl);
  }, [rebuiltUrl]);

  function addUtmParams() {
    const utms: QueryParam[] = [];

    if (utmSource.trim())
      utms.push({ key: "utm_source", value: utmSource.trim(), enabled: true });
    if (utmMedium.trim())
      utms.push({ key: "utm_medium", value: utmMedium.trim(), enabled: true });
    if (utmCampaign.trim())
      utms.push({ key: "utm_campaign", value: utmCampaign.trim(), enabled: true });
    if (utmTerm.trim())
      utms.push({ key: "utm_term", value: utmTerm.trim(), enabled: true });
    if (utmContent.trim())
      utms.push({ key: "utm_content", value: utmContent.trim(), enabled: true });

    if (utms.length === 0) return;

    setParams((prev) => {
      const filtered = prev.filter(
        (p) =>
          ![
            "utm_source",
            "utm_medium",
            "utm_campaign",
            "utm_term",
            "utm_content"
          ].includes(p.key)
      );
      return [...filtered, ...utms];
    });
  }

  async function onCopy() {
    await navigator.clipboard.writeText(rebuiltUrl);
  }

  function onDownload() {
    downloadTextFile("url.txt", rebuiltUrl);
  }

  function onReset() {
    setInput("");
    setParams([]);
    setEncodeOutput(true);

    setUtmSource("");
    setUtmMedium("");
    setUtmCampaign("");
    setUtmTerm("");
    setUtmContent("");
  }

  return (
    <div className="grid gap-6">
      {/* Input */}
      <div className="grid gap-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm font-semibold text-slate-900">Input URL</div>
          <div className="text-xs text-slate-500">
            Size: {formatBytes(inputBytes)}
            {warnLarge ? " • Large input detected" : ""}
          </div>
        </div>

        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Paste a full URL or querystring here…"
          rows={5}
          spellCheck={false}
        />

        {warnLarge && !overCap && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Large input detected (&gt; 2 MB). Parsing may take longer.
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

        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <Toggle
            checked={encodeOutput}
            onChange={setEncodeOutput}
            label="Encode output (recommended)"
            disabled={overCap}
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={onCopy} disabled={!rebuiltUrl || overCap}>
            Copy
          </Button>
          <Button type="button" onClick={onDownload} disabled={!rebuiltUrl || overCap}>
            Download
          </Button>
          <Button type="button" onClick={onReset}>
            Reset
          </Button>
        </div>
      </div>

      {/* Query Params Table */}
      <div className="grid gap-3">
        <div className="text-sm font-semibold text-slate-900">Query Parameters</div>

        {params.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
            No query parameters found. Add some like <span className="font-mono">?a=1&amp;b=2</span>
          </div>
        ) : (
          <div className="overflow-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Use</th>
                  <th className="px-4 py-3">Key</th>
                  <th className="px-4 py-3">Value</th>
                  <th className="px-4 py-3">Action</th>
                </tr>
              </thead>
              <tbody>
                {params.map((p, idx) => (
                  <tr key={idx} className="border-b border-slate-100">
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={p.enabled}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setParams((prev) =>
                            prev.map((x, i) => (i === idx ? { ...x, enabled: checked } : x))
                          );
                        }}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <input
                        className="w-full rounded-lg border border-slate-200 px-2 py-1 text-sm"
                        value={p.key}
                        onChange={(e) => {
                          const v = e.target.value;
                          setParams((prev) =>
                            prev.map((x, i) => (i === idx ? { ...x, key: v } : x))
                          );
                        }}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <input
                        className="w-full rounded-lg border border-slate-200 px-2 py-1 text-sm"
                        value={p.value}
                        onChange={(e) => {
                          const v = e.target.value;
                          setParams((prev) =>
                            prev.map((x, i) => (i === idx ? { ...x, value: v } : x))
                          );
                        }}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <Button
                        type="button"
                        className="px-3 py-1"
                        onClick={() => setParams((prev) => prev.filter((_, i) => i !== idx))}
                      >
                        Remove
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            onClick={() =>
              setParams((prev) => [...prev, { key: "", value: "", enabled: true }])
            }
          >
            + Add Param
          </Button>

          <Button
            type="button"
            onClick={() => setParams((prev) => prev.map((p) => ({ ...p, enabled: true })))}
          >
            Enable All
          </Button>

          <Button
            type="button"
            onClick={() => setParams((prev) => prev.map((p) => ({ ...p, enabled: false })))}
          >
            Disable All
          </Button>
        </div>
      </div>

      {/* UTM Builder */}
      <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="text-sm font-semibold text-slate-900">UTM Builder</div>

        <div className="grid gap-3 sm:grid-cols-2">
          <input
            className="h-11 rounded-xl border border-slate-200 px-3 text-sm"
            placeholder="utm_source"
            value={utmSource}
            onChange={(e) => setUtmSource(e.target.value)}
          />
          <input
            className="h-11 rounded-xl border border-slate-200 px-3 text-sm"
            placeholder="utm_medium"
            value={utmMedium}
            onChange={(e) => setUtmMedium(e.target.value)}
          />
          <input
            className="h-11 rounded-xl border border-slate-200 px-3 text-sm"
            placeholder="utm_campaign"
            value={utmCampaign}
            onChange={(e) => setUtmCampaign(e.target.value)}
          />
          <input
            className="h-11 rounded-xl border border-slate-200 px-3 text-sm"
            placeholder="utm_term"
            value={utmTerm}
            onChange={(e) => setUtmTerm(e.target.value)}
          />
          <input
            className="h-11 rounded-xl border border-slate-200 px-3 text-sm sm:col-span-2"
            placeholder="utm_content"
            value={utmContent}
            onChange={(e) => setUtmContent(e.target.value)}
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={addUtmParams}>
            Add / Replace UTM Params
          </Button>
        </div>

        <div className="text-xs text-slate-500">
          Tip: This does not fetch any data — it only edits your URL locally.
        </div>
      </div>

      {/* Output */}
      <div className="grid gap-2">
        <div className="text-sm font-semibold text-slate-900">Rebuilt URL</div>

        <Textarea value={rebuiltUrl} readOnly rows={4} />

        <div className="text-xs text-slate-500">
          Decoded preview (human-readable):
        </div>

        <Textarea value={decodedPreview} readOnly rows={3} />
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

type QueryParam = {
  key: string;
  value: string;
  enabled: boolean;
};

function safeDecodeURIComponent(value: string): string {
  try {
    return decodeURIComponent(value.replace(/\+/g, " "));
  } catch {
    return value;
  }
}

function safeEncodeURIComponent(value: string): string {
  try {
    return encodeURIComponent(value);
  } catch {
    return value;
  }
}

function parseUrlOrQuery(input: string): {
  baseUrl: string;
  params: QueryParam[];
  hashPart: string;
} {
  const trimmed = input.trim();
  if (!trimmed) return { baseUrl: "", params: [], hashPart: "" };

  let baseUrl = trimmed;
  let queryString = "";
  let hashPart = "";

  // Extract hash
  const hashIndex = baseUrl.indexOf("#");
  if (hashIndex >= 0) {
    hashPart = baseUrl.slice(hashIndex);
    baseUrl = baseUrl.slice(0, hashIndex);
  }

  // Extract query
  const qIndex = baseUrl.indexOf("?");
  if (qIndex >= 0) {
    queryString = baseUrl.slice(qIndex + 1);
    baseUrl = baseUrl.slice(0, qIndex);
  } else {
    // If input looks like query only
    if (trimmed.includes("=") && !trimmed.startsWith("http")) {
      queryString = trimmed;
      baseUrl = "";
    }
  }

  const params: QueryParam[] = [];

  if (queryString.trim()) {
    for (const part of queryString.split("&")) {
      if (!part.trim()) continue;

      const [rawKey, rawValue = ""] = part.split("=");
      const key = safeDecodeURIComponent(rawKey);
      const value = safeDecodeURIComponent(rawValue);

      params.push({
        key,
        value,
        enabled: true
      });
    }
  }

  return { baseUrl, params, hashPart };
}

function buildQueryString(params: QueryParam[], encode: boolean): string {
  const active = params.filter((p) => p.enabled && p.key.trim() !== "");

  return active
    .map((p) => {
      const k = encode ? safeEncodeURIComponent(p.key) : p.key;
      const v = encode ? safeEncodeURIComponent(p.value) : p.value;
      return `${k}=${v}`;
    })
    .join("&");
}

export function UrlTool() {
  const [input, setInput] = useState("");
  const [encodeOutput, setEncodeOutput] = useState(true);

  // UTM fields
  const [utmSource, setUtmSource] = useState("");
  const [utmMedium, setUtmMedium] = useState("");
  const [utmCampaign, setUtmCampaign] = useState("");
  const [utmTerm, setUtmTerm] = useState("");
  const [utmContent, setUtmContent] = useState("");

  const inputBytes = useMemo(() => bytesOfUtf8(input), [input]);
  const warnLarge = inputBytes > 2 * 1024 * 1024;
  const hardCap = 5 * 1024 * 1024;
  const overCap = inputBytes > hardCap;

  const debouncedInput = useDebouncedValue(input, 200);

  const parsed = useMemo(() => {
    if (!debouncedInput.trim()) {
      return { baseUrl: "", params: [] as QueryParam[], hashPart: "" };
    }
    return parseUrlOrQuery(debouncedInput);
  }, [debouncedInput]);

  const [params, setParams] = useState<QueryParam[]>([]);

  // Sync params when input changes
  useMemo(() => {
    setParams(parsed.params);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parsed.baseUrl, parsed.hashPart, debouncedInput]);

  const rebuiltUrl = useMemo(() => {
    if (overCap) return "";

    const query = buildQueryString(params, encodeOutput);

    if (!parsed.baseUrl && query) return query;

    const full =
      parsed.baseUrl +
      (query ? `?${query}` : "") +
      (parsed.hashPart || "");

    return full.trim();
  }, [params, parsed.baseUrl, parsed.hashPart, encodeOutput, overCap]);

  const decodedPreview = useMemo(() => {
    if (!rebuiltUrl.trim()) return "";
    return safeDecodeURIComponent(rebuiltUrl);
  }, [rebuiltUrl]);

  function addUtmParams() {
    const utms: QueryParam[] = [];

    if (utmSource.trim())
      utms.push({ key: "utm_source", value: utmSource.trim(), enabled: true });
    if (utmMedium.trim())
      utms.push({ key: "utm_medium", value: utmMedium.trim(), enabled: true });
    if (utmCampaign.trim())
      utms.push({ key: "utm_campaign", value: utmCampaign.trim(), enabled: true });
    if (utmTerm.trim())
      utms.push({ key: "utm_term", value: utmTerm.trim(), enabled: true });
    if (utmContent.trim())
      utms.push({ key: "utm_content", value: utmContent.trim(), enabled: true });

    if (utms.length === 0) return;

    setParams((prev) => {
      const filtered = prev.filter(
        (p) =>
          ![
            "utm_source",
            "utm_medium",
            "utm_campaign",
            "utm_term",
            "utm_content"
          ].includes(p.key)
      );
      return [...filtered, ...utms];
    });
  }

  async function onCopy() {
    await navigator.clipboard.writeText(rebuiltUrl);
  }

  function onDownload() {
    downloadTextFile("url.txt", rebuiltUrl);
  }

  function onReset() {
    setInput("");
    setParams([]);
    setEncodeOutput(true);

    setUtmSource("");
    setUtmMedium("");
    setUtmCampaign("");
    setUtmTerm("");
    setUtmContent("");
  }

  return (
    <div className="grid gap-6">
      {/* Input */}
      <div className="grid gap-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm font-semibold text-slate-900">Input URL</div>
          <div className="text-xs text-slate-500">
            Size: {formatBytes(inputBytes)}
            {warnLarge ? " • Large input detected" : ""}
          </div>
        </div>

        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Paste a full URL or querystring here…"
          rows={5}
          spellCheck={false}
        />

        {warnLarge && !overCap && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Large input detected (&gt; 2 MB). Parsing may take longer.
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

        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <Toggle
            checked={encodeOutput}
            onChange={setEncodeOutput}
            label="Encode output (recommended)"
            disabled={overCap}
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={onCopy} disabled={!rebuiltUrl || overCap}>
            Copy
          </Button>
          <Button type="button" onClick={onDownload} disabled={!rebuiltUrl || overCap}>
            Download
          </Button>
          <Button type="button" onClick={onReset}>
            Reset
          </Button>
        </div>
      </div>

      {/* Query Params Table */}
      <div className="grid gap-3">
        <div className="text-sm font-semibold text-slate-900">Query Parameters</div>

        {params.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
            No query parameters found. Add some like <span className="font-mono">?a=1&amp;b=2</span>
          </div>
        ) : (
          <div className="overflow-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Use</th>
                  <th className="px-4 py-3">Key</th>
                  <th className="px-4 py-3">Value</th>
                  <th className="px-4 py-3">Action</th>
                </tr>
              </thead>
              <tbody>
                {params.map((p, idx) => (
                  <tr key={idx} className="border-b border-slate-100">
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={p.enabled}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setParams((prev) =>
                            prev.map((x, i) => (i === idx ? { ...x, enabled: checked } : x))
                          );
                        }}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <input
                        className="w-full rounded-lg border border-slate-200 px-2 py-1 text-sm"
                        value={p.key}
                        onChange={(e) => {
                          const v = e.target.value;
                          setParams((prev) =>
                            prev.map((x, i) => (i === idx ? { ...x, key: v } : x))
                          );
                        }}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <input
                        className="w-full rounded-lg border border-slate-200 px-2 py-1 text-sm"
                        value={p.value}
                        onChange={(e) => {
                          const v = e.target.value;
                          setParams((prev) =>
                            prev.map((x, i) => (i === idx ? { ...x, value: v } : x))
                          );
                        }}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <Button
                        type="button"
                        className="px-3 py-1"
                        onClick={() => setParams((prev) => prev.filter((_, i) => i !== idx))}
                      >
                        Remove
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            onClick={() =>
              setParams((prev) => [...prev, { key: "", value: "", enabled: true }])
            }
          >
            + Add Param
          </Button>

          <Button
            type="button"
            onClick={() => setParams((prev) => prev.map((p) => ({ ...p, enabled: true })))}
          >
            Enable All
          </Button>

          <Button
            type="button"
            onClick={() => setParams((prev) => prev.map((p) => ({ ...p, enabled: false })))}
          >
            Disable All
          </Button>
        </div>
      </div>

      {/* UTM Builder */}
      <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="text-sm font-semibold text-slate-900">UTM Builder</div>

        <div className="grid gap-3 sm:grid-cols-2">
          <input
            className="h-11 rounded-xl border border-slate-200 px-3 text-sm"
            placeholder="utm_source"
            value={utmSource}
            onChange={(e) => setUtmSource(e.target.value)}
          />
          <input
            className="h-11 rounded-xl border border-slate-200 px-3 text-sm"
            placeholder="utm_medium"
            value={utmMedium}
            onChange={(e) => setUtmMedium(e.target.value)}
          />
          <input
            className="h-11 rounded-xl border border-slate-200 px-3 text-sm"
            placeholder="utm_campaign"
            value={utmCampaign}
            onChange={(e) => setUtmCampaign(e.target.value)}
          />
          <input
            className="h-11 rounded-xl border border-slate-200 px-3 text-sm"
            placeholder="utm_term"
            value={utmTerm}
            onChange={(e) => setUtmTerm(e.target.value)}
          />
          <input
            className="h-11 rounded-xl border border-slate-200 px-3 text-sm sm:col-span-2"
            placeholder="utm_content"
            value={utmContent}
            onChange={(e) => setUtmContent(e.target.value)}
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={addUtmParams}>
            Add / Replace UTM Params
          </Button>
        </div>

        <div className="text-xs text-slate-500">
          Tip: This does not fetch any data — it only edits your URL locally.
        </div>
      </div>

      {/* Output */}
      <div className="grid gap-2">
        <div className="text-sm font-semibold text-slate-900">Rebuilt URL</div>

        <Textarea value={rebuiltUrl} readOnly rows={4} />

        <div className="text-xs text-slate-500">
          Decoded preview (human-readable):
        </div>

        <Textarea value={decodedPreview} readOnly rows={3} />
      </div>
    </div>
  );
}
>>>>>>> a38c6781ba02f0335e4b9de11228d87416afd174
