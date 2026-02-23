<<<<<<< HEAD
import { useMemo, useState } from "react";
import { Button } from "../../components/ui/Button";
import { Textarea } from "../../components/ui/Textarea";
import { Toggle } from "../../components/ui/Toggle";
import { downloadTextFile } from "../../lib/download";

type Template = "Article" | "FAQPage" | "HowTo" | "Product" | "LocalBusiness";

function safeTrim(s: string): string {
  return (s ?? "").trim();
}

function safeUrlOrEmpty(s: string): string {
  const v = safeTrim(s);
  if (!v) return "";
  try {
    // allow absolute URLs only
    const u = new URL(v);
    return u.toString();
  } catch {
    return "";
  }
}

function toNumOrEmpty(s: string): number | "" {
  const t = safeTrim(s);
  if (!t) return "";
  const n = Number(t);
  return Number.isFinite(n) ? n : "";
}

function jsonPretty(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

function stripEmpty(obj: any): any {
  if (obj == null) return obj;
  if (Array.isArray(obj)) {
    const arr = obj.map(stripEmpty).filter((v) => v !== "" && v != null);
    return arr;
  }
  if (typeof obj === "object") {
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(obj)) {
      const cleaned = stripEmpty(v);
      const isEmptyArray = Array.isArray(cleaned) && cleaned.length === 0;
      const isEmptyObj =
        cleaned && typeof cleaned === "object" && !Array.isArray(cleaned) && Object.keys(cleaned).length === 0;
      if (cleaned === "" || cleaned == null || isEmptyArray || isEmptyObj) continue;
      out[k] = cleaned;
    }
    return out;
  }
  return obj;
}

/** Parse lines like:
 * Q: ...
 * A: ...
 * (blank line)
 */
function parseFaq(text: string): { q: string; a: string }[] {
  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  const items: { q: string; a: string }[] = [];
  let q = "";
  let a = "";

  function push() {
    const qq = safeTrim(q);
    const aa = safeTrim(a);
    if (qq && aa) items.push({ q: qq, a: aa });
    q = "";
    a = "";
  }

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line.trim()) {
      push();
      continue;
    }
    if (/^q\s*:/i.test(line)) {
      q = line.replace(/^q\s*:/i, "").trim();
      continue;
    }
    if (/^a\s*:/i.test(line)) {
      a = line.replace(/^a\s*:/i, "").trim();
      continue;
    }
    // If user didn't use Q:/A:, append smartly
    if (!q) q = line.trim();
    else if (!a) a = line.trim();
    else a += "\n" + line.trim();
  }
  push();
  return items;
}

/** Parse HowTo steps from lines (one step per line).
 * Supports "1. ..." or "- ..." or plain line.
 */
function parseHowToSteps(text: string): string[] {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => l.replace(/^(\d+\.)\s+/, "").replace(/^-\s+/, ""));
}

export function SchemaGeneratorTool() {
  const [template, setTemplate] = useState<Template>("Article");
  const [pretty, setPretty] = useState(true);

  // Shared
  const [name, setName] = useState("Text Toolkit");
  const [url, setUrl] = useState("https://example.com/tools/text-toolkit");
  const [description, setDescription] = useState(
    "A browser-only toolkit for formatting JSON, generating hashes, converting CSV↔JSON, and cleaning text."
  );
  const [imageUrl, setImageUrl] = useState("https://example.com/og-image.png");

  // Article
  const [headline, setHeadline] = useState("Text Toolkit: Browser-only Utilities");
  const [authorName, setAuthorName] = useState("Jesse");
  const [datePublished, setDatePublished] = useState("2026-02-14"); // ISO date string
  const [dateModified, setDateModified] = useState("");

  // FAQ
  const [faqText, setFaqText] = useState(
    "Q: Does this upload my data?\nA: No. Everything runs locally in your browser.\n\nQ: Does it call external APIs?\nA: No. The app is fully client-side."
  );

  // HowTo
  const [howToSupplyName, setHowToSupplyName] = useState(""); // optional
  const [howToToolName, setHowToToolName] = useState(""); // optional
  const [stepsText, setStepsText] = useState("1. Open the tool\n2. Paste your text\n3. Copy or download the result");

  // Product
  const [brand, setBrand] = useState("Text Toolkit");
  const [sku, setSku] = useState("");
  const [price, setPrice] = useState("0");
  const [currency, setCurrency] = useState("USD");
  const [availability, setAvailability] = useState("https://schema.org/InStock");

  // LocalBusiness
  const [businessType, setBusinessType] = useState("LocalBusiness"); // can be Restaurant, Store, etc.
  const [telephone, setTelephone] = useState("+1-555-555-5555");
  const [street, setStreet] = useState("123 Main St");
  const [city, setCity] = useState("Albuquerque");
  const [region, setRegion] = useState("NM");
  const [postalCode, setPostalCode] = useState("87101");
  const [country, setCountry] = useState("US");

  const jsonld = useMemo(() => {
    const base = {
      "@context": "https://schema.org"
    };

    if (template === "Article") {
      const obj = {
        ...base,
        "@type": "Article",
        headline: safeTrim(headline) || safeTrim(name),
        description: safeTrim(description),
        mainEntityOfPage: safeUrlOrEmpty(url) ? { "@type": "WebPage", "@id": safeUrlOrEmpty(url) } : undefined,
        image: safeUrlOrEmpty(imageUrl) || undefined,
        author: safeTrim(authorName) ? { "@type": "Person", name: safeTrim(authorName) } : undefined,
        datePublished: safeTrim(datePublished) || undefined,
        dateModified: safeTrim(dateModified) || undefined
      };
      return stripEmpty(obj);
    }

    if (template === "FAQPage") {
      const items = parseFaq(faqText).map((it) => ({
        "@type": "Question",
        name: it.q,
        acceptedAnswer: { "@type": "Answer", text: it.a }
      }));

      const obj = {
        ...base,
        "@type": "FAQPage",
        mainEntity: items
      };
      return stripEmpty(obj);
    }

    if (template === "HowTo") {
      const steps = parseHowToSteps(stepsText).map((s, idx) => ({
        "@type": "HowToStep",
        position: idx + 1,
        name: s,
        text: s
      }));

      const obj = {
        ...base,
        "@type": "HowTo",
        name: safeTrim(name),
        description: safeTrim(description),
        url: safeUrlOrEmpty(url) || undefined,
        image: safeUrlOrEmpty(imageUrl) || undefined,
        supply: safeTrim(howToSupplyName) ? [{ "@type": "HowToSupply", name: safeTrim(howToSupplyName) }] : undefined,
        tool: safeTrim(howToToolName) ? [{ "@type": "HowToTool", name: safeTrim(howToToolName) }] : undefined,
        step: steps
      };
      return stripEmpty(obj);
    }

    if (template === "Product") {
      const p = toNumOrEmpty(price);
      const obj = {
        ...base,
        "@type": "Product",
        name: safeTrim(name),
        description: safeTrim(description),
        image: safeUrlOrEmpty(imageUrl) || undefined,
        brand: safeTrim(brand) ? { "@type": "Brand", name: safeTrim(brand) } : undefined,
        sku: safeTrim(sku) || undefined,
        offers: {
          "@type": "Offer",
          url: safeUrlOrEmpty(url) || undefined,
          priceCurrency: safeTrim(currency) || undefined,
          price: p === "" ? undefined : p,
          availability: safeTrim(availability) || undefined
        }
      };
      return stripEmpty(obj);
    }

    // LocalBusiness
    const obj = {
      ...base,
      "@type": safeTrim(businessType) || "LocalBusiness",
      name: safeTrim(name),
      url: safeUrlOrEmpty(url) || undefined,
      description: safeTrim(description),
      image: safeUrlOrEmpty(imageUrl) || undefined,
      telephone: safeTrim(telephone) || undefined,
      address: {
        "@type": "PostalAddress",
        streetAddress: safeTrim(street) || undefined,
        addressLocality: safeTrim(city) || undefined,
        addressRegion: safeTrim(region) || undefined,
        postalCode: safeTrim(postalCode) || undefined,
        addressCountry: safeTrim(country) || undefined
      }
    };
    return stripEmpty(obj);
  }, [
    template,
    pretty,
    name,
    url,
    description,
    imageUrl,
    headline,
    authorName,
    datePublished,
    dateModified,
    faqText,
    stepsText,
    howToSupplyName,
    howToToolName,
    brand,
    sku,
    price,
    currency,
    availability,
    businessType,
    telephone,
    street,
    city,
    region,
    postalCode,
    country
  ]);

  const output = useMemo(() => (pretty ? jsonPretty(jsonld) : JSON.stringify(jsonld)), [jsonld, pretty]);

  const scriptTag = useMemo(() => {
    // Output snippet as plain text (user copies into HTML). No DOM injection here.
    return `<script type="application/ld+json">\n${output}\n</script>`;
  }, [output]);

  async function copy() {
    await navigator.clipboard.writeText(scriptTag);
  }

  function download() {
    downloadTextFile("schema.jsonld.html", scriptTag);
  }

  function reset() {
    setTemplate("Article");
    setPretty(true);

    setName("Text Toolkit");
    setUrl("https://example.com/tools/text-toolkit");
    setDescription("A browser-only toolkit for formatting JSON, generating hashes, converting CSV↔JSON, and cleaning text.");
    setImageUrl("https://example.com/og-image.png");

    setHeadline("Text Toolkit: Browser-only Utilities");
    setAuthorName("Jesse");
    setDatePublished("2026-02-14");
    setDateModified("");

    setFaqText(
      "Q: Does this upload my data?\nA: No. Everything runs locally in your browser.\n\nQ: Does it call external APIs?\nA: No. The app is fully client-side."
    );

    setHowToSupplyName("");
    setHowToToolName("");
    setStepsText("1. Open the tool\n2. Paste your text\n3. Copy or download the result");

    setBrand("Text Toolkit");
    setSku("");
    setPrice("0");
    setCurrency("USD");
    setAvailability("https://schema.org/InStock");

    setBusinessType("LocalBusiness");
    setTelephone("+1-555-555-5555");
    setStreet("123 Main St");
    setCity("Albuquerque");
    setRegion("NM");
    setPostalCode("87101");
    setCountry("US");
  }

  return (
    <div className="grid gap-6">
      {/* Template + pretty */}
      <div className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <div className="text-sm font-semibold text-slate-900">Template</div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1 text-sm text-slate-800">
            <span>Schema type</span>
            <select
              className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"
              value={template}
              onChange={(e) => setTemplate(e.target.value as Template)}
            >
              <option value="Article">Article</option>
              <option value="FAQPage">FAQPage</option>
              <option value="HowTo">HowTo</option>
              <option value="Product">Product</option>
              <option value="LocalBusiness">LocalBusiness</option>
            </select>
          </label>

          <div className="rounded-xl border border-slate-200 bg-white p-3">
            <Toggle checked={pretty} onChange={setPretty} label="Pretty JSON output" />
            <div className="mt-1 text-xs text-slate-500">Pretty output is easier to read and edit.</div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={copy} disabled={!output.trim()}>
            Copy JSON-LD snippet
          </Button>
          <Button type="button" onClick={download} disabled={!output.trim()}>
            Download snippet
          </Button>
          <Button type="button" onClick={reset}>
            Reset
          </Button>
        </div>
      </div>

      {/* Shared fields */}
      <div className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="text-sm font-semibold text-slate-900">Common fields</div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1 text-sm text-slate-800">
            <span>Name</span>
            <input
              className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm"
              value={name}
              onChange={(e) => setName(e.target.value)}
              spellCheck={false}
            />
          </label>

          <label className="grid gap-1 text-sm text-slate-800">
            <span>URL (absolute)</span>
            <input
              className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com/page"
              spellCheck={false}
            />
            <div className="text-xs text-slate-500">Invalid URLs are omitted from output.</div>
          </label>
        </div>

        <label className="grid gap-1 text-sm text-slate-800">
          <span>Description</span>
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} spellCheck={false} />
        </label>

        <label className="grid gap-1 text-sm text-slate-800">
          <span>Image URL (absolute, optional)</span>
          <input
            className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm"
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            placeholder="https://example.com/image.png"
            spellCheck={false}
          />
        </label>
      </div>

      {/* Template-specific fields */}
      {template === "Article" && (
        <div className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-sm font-semibold text-slate-900">Article fields</div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1 text-sm text-slate-800">
              <span>Headline</span>
              <input className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm" value={headline} onChange={(e) => setHeadline(e.target.value)} />
            </label>
            <label className="grid gap-1 text-sm text-slate-800">
              <span>Author name</span>
              <input className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm" value={authorName} onChange={(e) => setAuthorName(e.target.value)} />
            </label>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1 text-sm text-slate-800">
              <span>Date published (ISO: YYYY-MM-DD)</span>
              <input className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm" value={datePublished} onChange={(e) => setDatePublished(e.target.value)} />
            </label>
            <label className="grid gap-1 text-sm text-slate-800">
              <span>Date modified (optional)</span>
              <input className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm" value={dateModified} onChange={(e) => setDateModified(e.target.value)} />
            </label>
          </div>
        </div>
      )}

      {template === "FAQPage" && (
        <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-sm font-semibold text-slate-900">FAQ fields</div>
          <div className="text-xs text-slate-500">
            Format as blocks using <span className="font-mono">Q:</span> and <span className="font-mono">A:</span>.
          </div>
          <Textarea value={faqText} onChange={(e) => setFaqText(e.target.value)} rows={10} spellCheck={false} />
        </div>
      )}

      {template === "HowTo" && (
        <div className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-sm font-semibold text-slate-900">HowTo fields</div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1 text-sm text-slate-800">
              <span>Supply (optional)</span>
              <input className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm" value={howToSupplyName} onChange={(e) => setHowToSupplyName(e.target.value)} />
            </label>
            <label className="grid gap-1 text-sm text-slate-800">
              <span>Tool (optional)</span>
              <input className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm" value={howToToolName} onChange={(e) => setHowToToolName(e.target.value)} />
            </label>
          </div>
          <label className="grid gap-1 text-sm text-slate-800">
            <span>Steps (one per line)</span>
            <Textarea value={stepsText} onChange={(e) => setStepsText(e.target.value)} rows={8} spellCheck={false} />
          </label>
        </div>
      )}

      {template === "Product" && (
        <div className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-sm font-semibold text-slate-900">Product fields</div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1 text-sm text-slate-800">
              <span>Brand</span>
              <input className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm" value={brand} onChange={(e) => setBrand(e.target.value)} />
            </label>
            <label className="grid gap-1 text-sm text-slate-800">
              <span>SKU (optional)</span>
              <input className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm" value={sku} onChange={(e) => setSku(e.target.value)} />
            </label>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="grid gap-1 text-sm text-slate-800">
              <span>Price</span>
              <input className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm" value={price} onChange={(e) => setPrice(e.target.value)} />
            </label>
            <label className="grid gap-1 text-sm text-slate-800">
              <span>Currency</span>
              <input className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm" value={currency} onChange={(e) => setCurrency(e.target.value)} />
            </label>
            <label className="grid gap-1 text-sm text-slate-800">
              <span>Availability (schema.org URL)</span>
              <input className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm" value={availability} onChange={(e) => setAvailability(e.target.value)} />
            </label>
          </div>
        </div>
      )}

      {template === "LocalBusiness" && (
        <div className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-sm font-semibold text-slate-900">LocalBusiness fields</div>
          <div className="text-xs text-slate-500">
            You can set type to something more specific later (e.g., Restaurant, Store).
          </div>

          <label className="grid gap-1 text-sm text-slate-800">
            <span>Business type</span>
            <input className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm" value={businessType} onChange={(e) => setBusinessType(e.target.value)} />
          </label>

          <label className="grid gap-1 text-sm text-slate-800">
            <span>Telephone</span>
            <input className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm" value={telephone} onChange={(e) => setTelephone(e.target.value)} />
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1 text-sm text-slate-800">
              <span>Street</span>
              <input className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm" value={street} onChange={(e) => setStreet(e.target.value)} />
            </label>
            <label className="grid gap-1 text-sm text-slate-800">
              <span>City</span>
              <input className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm" value={city} onChange={(e) => setCity(e.target.value)} />
            </label>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <label className="grid gap-1 text-sm text-slate-800">
              <span>Region</span>
              <input className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm" value={region} onChange={(e) => setRegion(e.target.value)} />
            </label>
            <label className="grid gap-1 text-sm text-slate-800">
              <span>Postal code</span>
              <input className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm" value={postalCode} onChange={(e) => setPostalCode(e.target.value)} />
            </label>
            <label className="grid gap-1 text-sm text-slate-800">
              <span>Country</span>
              <input className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm" value={country} onChange={(e) => setCountry(e.target.value)} />
            </label>
          </div>
        </div>
      )}

      {/* Output */}
      <div className="grid gap-2">
        <div className="text-sm font-semibold text-slate-900">Generated JSON-LD</div>
        <Textarea value={scriptTag} readOnly rows={14} />
        <div className="text-xs text-slate-500">
          Copy this into your HTML &lt;head&gt;. Output is plain text (safe by design).
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

type Template = "Article" | "FAQPage" | "HowTo" | "Product" | "LocalBusiness";

function safeTrim(s: string): string {
  return (s ?? "").trim();
}

function safeUrlOrEmpty(s: string): string {
  const v = safeTrim(s);
  if (!v) return "";
  try {
    // allow absolute URLs only
    const u = new URL(v);
    return u.toString();
  } catch {
    return "";
  }
}

function toNumOrEmpty(s: string): number | "" {
  const t = safeTrim(s);
  if (!t) return "";
  const n = Number(t);
  return Number.isFinite(n) ? n : "";
}

function jsonPretty(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

function stripEmpty(obj: any): any {
  if (obj == null) return obj;
  if (Array.isArray(obj)) {
    const arr = obj.map(stripEmpty).filter((v) => v !== "" && v != null);
    return arr;
  }
  if (typeof obj === "object") {
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(obj)) {
      const cleaned = stripEmpty(v);
      const isEmptyArray = Array.isArray(cleaned) && cleaned.length === 0;
      const isEmptyObj =
        cleaned && typeof cleaned === "object" && !Array.isArray(cleaned) && Object.keys(cleaned).length === 0;
      if (cleaned === "" || cleaned == null || isEmptyArray || isEmptyObj) continue;
      out[k] = cleaned;
    }
    return out;
  }
  return obj;
}

/** Parse lines like:
 * Q: ...
 * A: ...
 * (blank line)
 */
function parseFaq(text: string): { q: string; a: string }[] {
  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  const items: { q: string; a: string }[] = [];
  let q = "";
  let a = "";

  function push() {
    const qq = safeTrim(q);
    const aa = safeTrim(a);
    if (qq && aa) items.push({ q: qq, a: aa });
    q = "";
    a = "";
  }

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line.trim()) {
      push();
      continue;
    }
    if (/^q\s*:/i.test(line)) {
      q = line.replace(/^q\s*:/i, "").trim();
      continue;
    }
    if (/^a\s*:/i.test(line)) {
      a = line.replace(/^a\s*:/i, "").trim();
      continue;
    }
    // If user didn't use Q:/A:, append smartly
    if (!q) q = line.trim();
    else if (!a) a = line.trim();
    else a += "\n" + line.trim();
  }
  push();
  return items;
}

/** Parse HowTo steps from lines (one step per line).
 * Supports "1. ..." or "- ..." or plain line.
 */
function parseHowToSteps(text: string): string[] {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => l.replace(/^(\d+\.)\s+/, "").replace(/^-\s+/, ""));
}

export function SchemaGeneratorTool() {
  const [template, setTemplate] = useState<Template>("Article");
  const [pretty, setPretty] = useState(true);

  // Shared
  const [name, setName] = useState("Text Toolkit");
  const [url, setUrl] = useState("https://example.com/tools/text-toolkit");
  const [description, setDescription] = useState(
    "A browser-only toolkit for formatting JSON, generating hashes, converting CSV↔JSON, and cleaning text."
  );
  const [imageUrl, setImageUrl] = useState("https://example.com/og-image.png");

  // Article
  const [headline, setHeadline] = useState("Text Toolkit: Browser-only Utilities");
  const [authorName, setAuthorName] = useState("Jesse");
  const [datePublished, setDatePublished] = useState("2026-02-14"); // ISO date string
  const [dateModified, setDateModified] = useState("");

  // FAQ
  const [faqText, setFaqText] = useState(
    "Q: Does this upload my data?\nA: No. Everything runs locally in your browser.\n\nQ: Does it call external APIs?\nA: No. The app is fully client-side."
  );

  // HowTo
  const [howToSupplyName, setHowToSupplyName] = useState(""); // optional
  const [howToToolName, setHowToToolName] = useState(""); // optional
  const [stepsText, setStepsText] = useState("1. Open the tool\n2. Paste your text\n3. Copy or download the result");

  // Product
  const [brand, setBrand] = useState("Text Toolkit");
  const [sku, setSku] = useState("");
  const [price, setPrice] = useState("0");
  const [currency, setCurrency] = useState("USD");
  const [availability, setAvailability] = useState("https://schema.org/InStock");

  // LocalBusiness
  const [businessType, setBusinessType] = useState("LocalBusiness"); // can be Restaurant, Store, etc.
  const [telephone, setTelephone] = useState("+1-555-555-5555");
  const [street, setStreet] = useState("123 Main St");
  const [city, setCity] = useState("Albuquerque");
  const [region, setRegion] = useState("NM");
  const [postalCode, setPostalCode] = useState("87101");
  const [country, setCountry] = useState("US");

  const jsonld = useMemo(() => {
    const base = {
      "@context": "https://schema.org"
    };

    if (template === "Article") {
      const obj = {
        ...base,
        "@type": "Article",
        headline: safeTrim(headline) || safeTrim(name),
        description: safeTrim(description),
        mainEntityOfPage: safeUrlOrEmpty(url) ? { "@type": "WebPage", "@id": safeUrlOrEmpty(url) } : undefined,
        image: safeUrlOrEmpty(imageUrl) || undefined,
        author: safeTrim(authorName) ? { "@type": "Person", name: safeTrim(authorName) } : undefined,
        datePublished: safeTrim(datePublished) || undefined,
        dateModified: safeTrim(dateModified) || undefined
      };
      return stripEmpty(obj);
    }

    if (template === "FAQPage") {
      const items = parseFaq(faqText).map((it) => ({
        "@type": "Question",
        name: it.q,
        acceptedAnswer: { "@type": "Answer", text: it.a }
      }));

      const obj = {
        ...base,
        "@type": "FAQPage",
        mainEntity: items
      };
      return stripEmpty(obj);
    }

    if (template === "HowTo") {
      const steps = parseHowToSteps(stepsText).map((s, idx) => ({
        "@type": "HowToStep",
        position: idx + 1,
        name: s,
        text: s
      }));

      const obj = {
        ...base,
        "@type": "HowTo",
        name: safeTrim(name),
        description: safeTrim(description),
        url: safeUrlOrEmpty(url) || undefined,
        image: safeUrlOrEmpty(imageUrl) || undefined,
        supply: safeTrim(howToSupplyName) ? [{ "@type": "HowToSupply", name: safeTrim(howToSupplyName) }] : undefined,
        tool: safeTrim(howToToolName) ? [{ "@type": "HowToTool", name: safeTrim(howToToolName) }] : undefined,
        step: steps
      };
      return stripEmpty(obj);
    }

    if (template === "Product") {
      const p = toNumOrEmpty(price);
      const obj = {
        ...base,
        "@type": "Product",
        name: safeTrim(name),
        description: safeTrim(description),
        image: safeUrlOrEmpty(imageUrl) || undefined,
        brand: safeTrim(brand) ? { "@type": "Brand", name: safeTrim(brand) } : undefined,
        sku: safeTrim(sku) || undefined,
        offers: {
          "@type": "Offer",
          url: safeUrlOrEmpty(url) || undefined,
          priceCurrency: safeTrim(currency) || undefined,
          price: p === "" ? undefined : p,
          availability: safeTrim(availability) || undefined
        }
      };
      return stripEmpty(obj);
    }

    // LocalBusiness
    const obj = {
      ...base,
      "@type": safeTrim(businessType) || "LocalBusiness",
      name: safeTrim(name),
      url: safeUrlOrEmpty(url) || undefined,
      description: safeTrim(description),
      image: safeUrlOrEmpty(imageUrl) || undefined,
      telephone: safeTrim(telephone) || undefined,
      address: {
        "@type": "PostalAddress",
        streetAddress: safeTrim(street) || undefined,
        addressLocality: safeTrim(city) || undefined,
        addressRegion: safeTrim(region) || undefined,
        postalCode: safeTrim(postalCode) || undefined,
        addressCountry: safeTrim(country) || undefined
      }
    };
    return stripEmpty(obj);
  }, [
    template,
    pretty,
    name,
    url,
    description,
    imageUrl,
    headline,
    authorName,
    datePublished,
    dateModified,
    faqText,
    stepsText,
    howToSupplyName,
    howToToolName,
    brand,
    sku,
    price,
    currency,
    availability,
    businessType,
    telephone,
    street,
    city,
    region,
    postalCode,
    country
  ]);

  const output = useMemo(() => (pretty ? jsonPretty(jsonld) : JSON.stringify(jsonld)), [jsonld, pretty]);

  const scriptTag = useMemo(() => {
    // Output snippet as plain text (user copies into HTML). No DOM injection here.
    return `<script type="application/ld+json">\n${output}\n</script>`;
  }, [output]);

  async function copy() {
    await navigator.clipboard.writeText(scriptTag);
  }

  function download() {
    downloadTextFile("schema.jsonld.html", scriptTag);
  }

  function reset() {
    setTemplate("Article");
    setPretty(true);

    setName("Text Toolkit");
    setUrl("https://example.com/tools/text-toolkit");
    setDescription("A browser-only toolkit for formatting JSON, generating hashes, converting CSV↔JSON, and cleaning text.");
    setImageUrl("https://example.com/og-image.png");

    setHeadline("Text Toolkit: Browser-only Utilities");
    setAuthorName("Jesse");
    setDatePublished("2026-02-14");
    setDateModified("");

    setFaqText(
      "Q: Does this upload my data?\nA: No. Everything runs locally in your browser.\n\nQ: Does it call external APIs?\nA: No. The app is fully client-side."
    );

    setHowToSupplyName("");
    setHowToToolName("");
    setStepsText("1. Open the tool\n2. Paste your text\n3. Copy or download the result");

    setBrand("Text Toolkit");
    setSku("");
    setPrice("0");
    setCurrency("USD");
    setAvailability("https://schema.org/InStock");

    setBusinessType("LocalBusiness");
    setTelephone("+1-555-555-5555");
    setStreet("123 Main St");
    setCity("Albuquerque");
    setRegion("NM");
    setPostalCode("87101");
    setCountry("US");
  }

  return (
    <div className="grid gap-6">
      {/* Template + pretty */}
      <div className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <div className="text-sm font-semibold text-slate-900">Template</div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1 text-sm text-slate-800">
            <span>Schema type</span>
            <select
              className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"
              value={template}
              onChange={(e) => setTemplate(e.target.value as Template)}
            >
              <option value="Article">Article</option>
              <option value="FAQPage">FAQPage</option>
              <option value="HowTo">HowTo</option>
              <option value="Product">Product</option>
              <option value="LocalBusiness">LocalBusiness</option>
            </select>
          </label>

          <div className="rounded-xl border border-slate-200 bg-white p-3">
            <Toggle checked={pretty} onChange={setPretty} label="Pretty JSON output" />
            <div className="mt-1 text-xs text-slate-500">Pretty output is easier to read and edit.</div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={copy} disabled={!output.trim()}>
            Copy JSON-LD snippet
          </Button>
          <Button type="button" onClick={download} disabled={!output.trim()}>
            Download snippet
          </Button>
          <Button type="button" onClick={reset}>
            Reset
          </Button>
        </div>
      </div>

      {/* Shared fields */}
      <div className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="text-sm font-semibold text-slate-900">Common fields</div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1 text-sm text-slate-800">
            <span>Name</span>
            <input
              className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm"
              value={name}
              onChange={(e) => setName(e.target.value)}
              spellCheck={false}
            />
          </label>

          <label className="grid gap-1 text-sm text-slate-800">
            <span>URL (absolute)</span>
            <input
              className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com/page"
              spellCheck={false}
            />
            <div className="text-xs text-slate-500">Invalid URLs are omitted from output.</div>
          </label>
        </div>

        <label className="grid gap-1 text-sm text-slate-800">
          <span>Description</span>
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} spellCheck={false} />
        </label>

        <label className="grid gap-1 text-sm text-slate-800">
          <span>Image URL (absolute, optional)</span>
          <input
            className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm"
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            placeholder="https://example.com/image.png"
            spellCheck={false}
          />
        </label>
      </div>

      {/* Template-specific fields */}
      {template === "Article" && (
        <div className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-sm font-semibold text-slate-900">Article fields</div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1 text-sm text-slate-800">
              <span>Headline</span>
              <input className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm" value={headline} onChange={(e) => setHeadline(e.target.value)} />
            </label>
            <label className="grid gap-1 text-sm text-slate-800">
              <span>Author name</span>
              <input className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm" value={authorName} onChange={(e) => setAuthorName(e.target.value)} />
            </label>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1 text-sm text-slate-800">
              <span>Date published (ISO: YYYY-MM-DD)</span>
              <input className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm" value={datePublished} onChange={(e) => setDatePublished(e.target.value)} />
            </label>
            <label className="grid gap-1 text-sm text-slate-800">
              <span>Date modified (optional)</span>
              <input className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm" value={dateModified} onChange={(e) => setDateModified(e.target.value)} />
            </label>
          </div>
        </div>
      )}

      {template === "FAQPage" && (
        <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-sm font-semibold text-slate-900">FAQ fields</div>
          <div className="text-xs text-slate-500">
            Format as blocks using <span className="font-mono">Q:</span> and <span className="font-mono">A:</span>.
          </div>
          <Textarea value={faqText} onChange={(e) => setFaqText(e.target.value)} rows={10} spellCheck={false} />
        </div>
      )}

      {template === "HowTo" && (
        <div className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-sm font-semibold text-slate-900">HowTo fields</div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1 text-sm text-slate-800">
              <span>Supply (optional)</span>
              <input className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm" value={howToSupplyName} onChange={(e) => setHowToSupplyName(e.target.value)} />
            </label>
            <label className="grid gap-1 text-sm text-slate-800">
              <span>Tool (optional)</span>
              <input className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm" value={howToToolName} onChange={(e) => setHowToToolName(e.target.value)} />
            </label>
          </div>
          <label className="grid gap-1 text-sm text-slate-800">
            <span>Steps (one per line)</span>
            <Textarea value={stepsText} onChange={(e) => setStepsText(e.target.value)} rows={8} spellCheck={false} />
          </label>
        </div>
      )}

      {template === "Product" && (
        <div className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-sm font-semibold text-slate-900">Product fields</div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1 text-sm text-slate-800">
              <span>Brand</span>
              <input className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm" value={brand} onChange={(e) => setBrand(e.target.value)} />
            </label>
            <label className="grid gap-1 text-sm text-slate-800">
              <span>SKU (optional)</span>
              <input className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm" value={sku} onChange={(e) => setSku(e.target.value)} />
            </label>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="grid gap-1 text-sm text-slate-800">
              <span>Price</span>
              <input className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm" value={price} onChange={(e) => setPrice(e.target.value)} />
            </label>
            <label className="grid gap-1 text-sm text-slate-800">
              <span>Currency</span>
              <input className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm" value={currency} onChange={(e) => setCurrency(e.target.value)} />
            </label>
            <label className="grid gap-1 text-sm text-slate-800">
              <span>Availability (schema.org URL)</span>
              <input className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm" value={availability} onChange={(e) => setAvailability(e.target.value)} />
            </label>
          </div>
        </div>
      )}

      {template === "LocalBusiness" && (
        <div className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-sm font-semibold text-slate-900">LocalBusiness fields</div>
          <div className="text-xs text-slate-500">
            You can set type to something more specific later (e.g., Restaurant, Store).
          </div>

          <label className="grid gap-1 text-sm text-slate-800">
            <span>Business type</span>
            <input className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm" value={businessType} onChange={(e) => setBusinessType(e.target.value)} />
          </label>

          <label className="grid gap-1 text-sm text-slate-800">
            <span>Telephone</span>
            <input className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm" value={telephone} onChange={(e) => setTelephone(e.target.value)} />
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1 text-sm text-slate-800">
              <span>Street</span>
              <input className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm" value={street} onChange={(e) => setStreet(e.target.value)} />
            </label>
            <label className="grid gap-1 text-sm text-slate-800">
              <span>City</span>
              <input className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm" value={city} onChange={(e) => setCity(e.target.value)} />
            </label>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <label className="grid gap-1 text-sm text-slate-800">
              <span>Region</span>
              <input className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm" value={region} onChange={(e) => setRegion(e.target.value)} />
            </label>
            <label className="grid gap-1 text-sm text-slate-800">
              <span>Postal code</span>
              <input className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm" value={postalCode} onChange={(e) => setPostalCode(e.target.value)} />
            </label>
            <label className="grid gap-1 text-sm text-slate-800">
              <span>Country</span>
              <input className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm" value={country} onChange={(e) => setCountry(e.target.value)} />
            </label>
          </div>
        </div>
      )}

      {/* Output */}
      <div className="grid gap-2">
        <div className="text-sm font-semibold text-slate-900">Generated JSON-LD</div>
        <Textarea value={scriptTag} readOnly rows={14} />
        <div className="text-xs text-slate-500">
          Copy this into your HTML &lt;head&gt;. Output is plain text (safe by design).
        </div>
      </div>
    </div>
  );
}
>>>>>>> a38c6781ba02f0335e4b9de11228d87416afd174
