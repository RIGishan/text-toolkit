import { useMemo, useState } from "react";
import { Button } from "../../components/ui/Button";
import { Textarea } from "../../components/ui/Textarea";
import { downloadTextFile } from "../../lib/download";

function clampText(s: string, max: number): { text: string; truncated: boolean } {
  const t = s ?? "";
  if (t.length <= max) return { text: t, truncated: false };
  return { text: t.slice(0, Math.max(0, max - 1)) + "…", truncated: true };
}

function escapeAttr(value: string): string {
  // Safe HTML attribute escaping for the generated snippet.
  // This is output as text only (not injected), but escaping is still correct.
  return (value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function safeUrlDisplay(url: string): string {
  const u = (url ?? "").trim();
  if (!u) return "";
  try {
    const parsed = new URL(u);
    return parsed.hostname + parsed.pathname;
  } catch {
    // If invalid, show raw trimmed
    return u;
  }
}

function addMeta(lines: string[], attrs: Record<string, string | undefined>) {
  const parts: string[] = [];
  for (const [k, v] of Object.entries(attrs)) {
    if (!v) continue;
    parts.push(`${k}="${escapeAttr(v)}"`);
  }
  if (parts.length === 0) return;
  lines.push(`<meta ${parts.join(" ")} />`);
}

function addLink(lines: string[], attrs: Record<string, string | undefined>) {
  const parts: string[] = [];
  for (const [k, v] of Object.entries(attrs)) {
    if (!v) continue;
    parts.push(`${k}="${escapeAttr(v)}"`);
  }
  if (parts.length === 0) return;
  lines.push(`<link ${parts.join(" ")} />`);
}

type TwitterCard = "summary" | "summary_large_image";

export function MetaPreviewTool() {
  // Core fields
  const [pageTitle, setPageTitle] = useState("Text Toolkit — Free Browser-Only Utilities");
  const [description, setDescription] = useState(
    "Format JSON, generate hashes, convert CSV↔JSON, and clean text — runs locally in your browser (no uploads)."
  );
  const [canonicalUrl, setCanonicalUrl] = useState("https://example.com/tools/text-toolkit");

  // OG
  const [ogTitle, setOgTitle] = useState("");
  const [ogDescription, setOgDescription] = useState("");
  const [ogUrl, setOgUrl] = useState("");
  const [ogImage, setOgImage] = useState("");

  // Twitter
  const [twitterCard, setTwitterCard] = useState<TwitterCard>("summary_large_image");
  const [twitterTitle, setTwitterTitle] = useState("");
  const [twitterDescription, setTwitterDescription] = useState("");
  const [twitterImage, setTwitterImage] = useState("");

  // Basic previews (approximate, not exact platform rendering)
  const googleTitle = useMemo(() => clampText(pageTitle.trim(), 60), [pageTitle]);
  const googleDesc = useMemo(() => clampText(description.trim(), 160), [description]);
  const googleDisplayUrl = useMemo(() => safeUrlDisplay(canonicalUrl), [canonicalUrl]);

  const resolvedOgTitle = (ogTitle.trim() || pageTitle.trim()).slice(0);
  const resolvedOgDesc = (ogDescription.trim() || description.trim()).slice(0);
  const resolvedOgUrl = (ogUrl.trim() || canonicalUrl.trim()).slice(0);

  const resolvedTwTitle = (twitterTitle.trim() || resolvedOgTitle || pageTitle.trim()).slice(0);
  const resolvedTwDesc = (twitterDescription.trim() || resolvedOgDesc || description.trim()).slice(0);
  const resolvedTwImg = (twitterImage.trim() || ogImage.trim()).slice(0);

  const ogTitlePreview = useMemo(() => clampText(resolvedOgTitle, 70), [resolvedOgTitle]);
  const ogDescPreview = useMemo(() => clampText(resolvedOgDesc, 200), [resolvedOgDesc]);

  const twTitlePreview = useMemo(() => clampText(resolvedTwTitle, 70), [resolvedTwTitle]);
  const twDescPreview = useMemo(() => clampText(resolvedTwDesc, 200), [resolvedTwDesc]);

  const snippet = useMemo(() => {
    const lines: string[] = [];

    // Standard
    if (pageTitle.trim()) lines.push(`<title>${escapeAttr(pageTitle.trim())}</title>`);
    addMeta(lines, { name: "description", content: description.trim() || undefined });
    addLink(lines, { rel: "canonical", href: canonicalUrl.trim() || undefined });

    // Open Graph
    const ot = resolvedOgTitle.trim();
    const od = resolvedOgDesc.trim();
    const ou = resolvedOgUrl.trim();
    const oi = ogImage.trim();

    addMeta(lines, { property: "og:title", content: ot || undefined });
    addMeta(lines, { property: "og:description", content: od || undefined });
    addMeta(lines, { property: "og:url", content: ou || undefined });
    addMeta(lines, { property: "og:type", content: "website" });
    addMeta(lines, { property: "og:image", content: oi || undefined });

    // Twitter
    addMeta(lines, { name: "twitter:card", content: twitterCard });
    addMeta(lines, { name: "twitter:title", content: resolvedTwTitle.trim() || undefined });
    addMeta(lines, { name: "twitter:description", content: resolvedTwDesc.trim() || undefined });
    addMeta(lines, { name: "twitter:image", content: resolvedTwImg || undefined });

    return lines.filter(Boolean).join("\n");
  }, [
    pageTitle,
    description,
    canonicalUrl,
    resolvedOgTitle,
    resolvedOgDesc,
    resolvedOgUrl,
    ogImage,
    twitterCard,
    resolvedTwTitle,
    resolvedTwDesc,
    resolvedTwImg
  ]);

  async function copy() {
    await navigator.clipboard.writeText(snippet);
  }

  function download() {
    downloadTextFile("meta-tags.html", snippet);
  }

  function reset() {
    setPageTitle("Text Toolkit — Free Browser-Only Utilities");
    setDescription("Format JSON, generate hashes, convert CSV↔JSON, and clean text — runs locally in your browser (no uploads).");
    setCanonicalUrl("https://example.com/tools/text-toolkit");

    setOgTitle("");
    setOgDescription("");
    setOgUrl("");
    setOgImage("");

    setTwitterCard("summary_large_image");
    setTwitterTitle("");
    setTwitterDescription("");
    setTwitterImage("");
  }

  return (
    <div className="grid gap-6">
      {/* Inputs */}
      <div className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="text-sm font-semibold text-slate-900">Fields</div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="grid gap-2">
            <label className="text-sm font-semibold text-slate-900">Title</label>
            <input
              className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm"
              value={pageTitle}
              onChange={(e) => setPageTitle(e.target.value)}
              placeholder="Page title…"
              spellCheck={false}
            />
            <div className="text-xs text-slate-500">
              {pageTitle.length} chars • Google title approx: 60 chars
              {googleTitle.truncated ? " • will truncate" : ""}
            </div>
          </div>

          <div className="grid gap-2">
            <label className="text-sm font-semibold text-slate-900">Canonical URL</label>
            <input
              className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm"
              value={canonicalUrl}
              onChange={(e) => setCanonicalUrl(e.target.value)}
              placeholder="https://example.com/page"
              spellCheck={false}
            />
            <div className="text-xs text-slate-500">Used for &lt;link rel="canonical"&gt; and default OG URL.</div>
          </div>
        </div>

        <div className="grid gap-2">
          <label className="text-sm font-semibold text-slate-900">Description</label>
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            placeholder="Meta description…"
            spellCheck={false}
          />
          <div className="text-xs text-slate-500">
            {description.length} chars • Google description approx: 160 chars
            {googleDesc.truncated ? " • will truncate" : ""}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Open Graph</div>
            <div className="mt-2 grid gap-2">
              <input
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"
                value={ogTitle}
                onChange={(e) => setOgTitle(e.target.value)}
                placeholder="og:title (optional)"
                spellCheck={false}
              />
              <input
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"
                value={ogUrl}
                onChange={(e) => setOgUrl(e.target.value)}
                placeholder="og:url (optional)"
                spellCheck={false}
              />
              <input
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"
                value={ogImage}
                onChange={(e) => setOgImage(e.target.value)}
                placeholder="og:image URL (optional)"
                spellCheck={false}
              />
              <Textarea
                value={ogDescription}
                onChange={(e) => setOgDescription(e.target.value)}
                rows={3}
                placeholder="og:description (optional)"
                spellCheck={false}
              />
              <div className="text-xs text-slate-500">
                If left blank, OG title/description default to Title/Description.
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Twitter</div>
            <div className="mt-2 grid gap-2">
              <label className="text-sm text-slate-800">
                Card type
                <select
                  className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"
                  value={twitterCard}
                  onChange={(e) => setTwitterCard(e.target.value as TwitterCard)}
                >
                  <option value="summary">summary</option>
                  <option value="summary_large_image">summary_large_image</option>
                </select>
              </label>

              <input
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"
                value={twitterTitle}
                onChange={(e) => setTwitterTitle(e.target.value)}
                placeholder="twitter:title (optional)"
                spellCheck={false}
              />
              <input
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"
                value={twitterImage}
                onChange={(e) => setTwitterImage(e.target.value)}
                placeholder="twitter:image URL (optional)"
                spellCheck={false}
              />
              <Textarea
                value={twitterDescription}
                onChange={(e) => setTwitterDescription(e.target.value)}
                rows={3}
                placeholder="twitter:description (optional)"
                spellCheck={false}
              />
              <div className="text-xs text-slate-500">
                Defaults to OG fields (then Title/Description) when blank.
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={copy} disabled={!snippet.trim()}>
            Copy snippet
          </Button>
          <Button type="button" onClick={download} disabled={!snippet.trim()}>
            Download snippet
          </Button>
          <Button type="button" onClick={reset}>
            Reset
          </Button>
        </div>
      </div>

      {/* Previews */}
      <div className="grid gap-4 sm:grid-cols-2">
        {/* Google-ish preview */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Search preview</div>
          <div className="mt-2 text-xs text-slate-500">
            Approximation. Real results depend on Google and query context.
          </div>

          <div className="mt-3 grid gap-1">
            <div className="text-base font-semibold text-blue-700">
              {googleTitle.text || "(no title)"}
            </div>
            <div className="text-xs text-emerald-700">{googleDisplayUrl || "(no url)"}</div>
            <div className="text-sm text-slate-700">
              {googleDesc.text || "(no description)"}
            </div>
          </div>
        </div>

        {/* Social preview */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Social preview</div>
          <div className="mt-2 text-xs text-slate-500">
            Approximation. Platforms may render differently.
          </div>

          <div className="mt-3 overflow-hidden rounded-xl border border-slate-200">
            {/* Image placeholder (no external fetching) */}
            <div className="grid place-items-center bg-slate-100 px-4 py-10 text-xs text-slate-500">
              {resolvedTwImg || ogImage ? "Image URL provided (not fetched)" : "No image"}
            </div>
            <div className="grid gap-1 p-3">
              <div className="text-xs text-slate-500">{safeUrlDisplay(resolvedOgUrl || canonicalUrl) || "(no url)"}</div>
              <div className="text-sm font-semibold text-slate-900">
                {twTitlePreview.text || "(no title)"}
              </div>
              <div className="text-sm text-slate-700">
                {twDescPreview.text || "(no description)"}
              </div>
              <div className="mt-1 text-xs text-slate-500">Twitter card: {twitterCard}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Snippet output */}
      <div className="grid gap-2">
        <div className="text-sm font-semibold text-slate-900">Generated snippet</div>
        <Textarea value={snippet} readOnly rows={12} />
        <div className="text-xs text-slate-500">
          This is plain text output. Paste into your HTML head section. No scripts included.
        </div>
      </div>
    </div>
  );
}
