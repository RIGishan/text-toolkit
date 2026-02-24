import { useMemo, useState } from "react";
import { Button } from "../../components/ui/Button";
import { Textarea } from "../../components/ui/Textarea";
import { downloadTextFile } from "../../lib/download";
import { bytesOfUtf8, formatBytes } from "../../lib/text";
import { generateHashtagsFromContent } from "../../lib/hashtagGenerator";

type Platform = "facebook" | "x" | "linkedin" | "instagram" | "reddit" | "youtube" | "tiktok";

type PlatformSpec = {
  key: Platform;
  name: string;
  previewChars: number;
  hint: string;
  maxHashtags: number;
};

const PLATFORMS: PlatformSpec[] = [
  { key: "facebook", name: "Facebook", previewChars: 350, hint: "Readable + structured.", maxHashtags: 5 },
  { key: "x", name: "X", previewChars: 280, hint: "Short + punchy (approx).", maxHashtags: 2 },
  { key: "linkedin", name: "LinkedIn", previewChars: 300, hint: "Often truncates with “see more”.", maxHashtags: 5 },
  { key: "instagram", name: "Instagram", previewChars: 220, hint: "Hook matters; hashtags ok.", maxHashtags: 15 },
  { key: "reddit", name: "Reddit", previewChars: 400, hint: "Detail ok; hashtags optional.", maxHashtags: 0 },
  { key: "youtube", name: "YouTube Community", previewChars: 300, hint: "Quick update format.", maxHashtags: 3 },
  { key: "tiktok", name: "TikTok Caption", previewChars: 150, hint: "Very short caption vibe.", maxHashtags: 6 }
];

const WARN_AT = 2 * 1024 * 1024;
const HARD_CAP = 5 * 1024 * 1024;

type EmojiItem = { emoji: string; name: string; tags: string[] };

const EMOJI_LIBRARY: EmojiItem[] = [
  { emoji: "🔥", name: "fire", tags: ["hot", "trend"] },
  { emoji: "🚀", name: "rocket", tags: ["launch", "grow"] },
  { emoji: "✅", name: "check", tags: ["done", "win"] },
  { emoji: "📌", name: "pin", tags: ["save"] },
  { emoji: "💡", name: "idea", tags: ["tip", "insight"] },
  { emoji: "📈", name: "chart up", tags: ["growth", "marketing"] },
  { emoji: "🧠", name: "brain", tags: ["learn", "smart"] },
  { emoji: "⚡", name: "bolt", tags: ["fast", "quick"] },
  { emoji: "🎯", name: "target", tags: ["focus"] },
  { emoji: "🛠️", name: "tools", tags: ["build", "dev"] },
  { emoji: "🔒", name: "lock", tags: ["security", "safe"] },
  { emoji: "🧩", name: "puzzle", tags: ["solve"] },
  { emoji: "📝", name: "memo", tags: ["write"] },
  { emoji: "📣", name: "megaphone", tags: ["announce"] },
  { emoji: "⭐", name: "star", tags: ["best"] },
  { emoji: "🎉", name: "party", tags: ["celebrate"] },
  { emoji: "⏱️", name: "timer", tags: ["time"] },
  { emoji: "👀", name: "eyes", tags: ["look"] },
  { emoji: "🤝", name: "handshake", tags: ["community"] },
  { emoji: "💬", name: "speech", tags: ["comment"] },
  { emoji: "🔁", name: "repeat", tags: ["again"] },
  { emoji: "📎", name: "paperclip", tags: ["link"] },
  { emoji: "🧵", name: "thread", tags: ["series"] },
  { emoji: "💥", name: "boom", tags: ["impact"] },
  { emoji: "🌟", name: "sparkles", tags: ["shine"] },
  { emoji: "📚", name: "books", tags: ["learn"] },
  { emoji: "🧱", name: "brick", tags: ["build"] },
  { emoji: "🧼", name: "clean", tags: ["cleaning"] },
  { emoji: "🎬", name: "clapper", tags: ["content"] },
  { emoji: "🧲", name: "magnet", tags: ["attract"] },
  { emoji: "🧯", name: "fix", tags: ["repair"] },
  { emoji: "🧭", name: "compass", tags: ["guide"] },
  { emoji: "🧪", name: "experiment", tags: ["test"] },
  { emoji: "📊", name: "stats", tags: ["data"] },
  { emoji: "🧾", name: "receipt", tags: ["proof"] }
];

function normalizeCompact(text: string): string {
  return (text || "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/[ \t]+$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function truncateChars(text: string, max: number): string {
  const t = text || "";
  if (t.length <= max) return t;
  return t.slice(0, max - 1) + "…";
}

function splitSentences(text: string): string[] {
  const t = normalizeCompact(text).replace(/\n+/g, " ");
  const parts = t.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean);
  if (parts.length <= 1) return t.split(/\s{2,}|\n+/).map((s) => s.trim()).filter(Boolean);
  return parts;
}

function htmlToStructuredText(html: string): string {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const root = doc.body;

  const lines: string[] = [];

  function txt(node: Node): string {
    return (node.textContent || "").replace(/\s+/g, " ").trim();
  }

  function walk(node: Node) {
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const el = node as Element;
    const tag = el.tagName.toLowerCase();

    if (tag === "h1") {
      const t = txt(el);
      if (t) lines.push(`# ${t}`, "");
      return;
    }
    if (tag === "h2") {
      const t = txt(el);
      if (t) lines.push(`## ${t}`, "");
      return;
    }
    if (tag === "h3") {
      const t = txt(el);
      if (t) lines.push(`### ${t}`, "");
      return;
    }
    if (tag === "hr") {
      lines.push("---", "");
      return;
    }
    if (tag === "p" || tag === "blockquote") {
      const t = txt(el);
      if (t) lines.push(t, "");
      return;
    }
    if (tag === "br") {
      lines.push("");
      return;
    }
    if (tag === "ul" || tag === "ol") {
      const lis = Array.from(el.querySelectorAll(":scope > li"));
      for (const li of lis) {
        const t = txt(li);
        if (t) lines.push(`- ${t}`);
      }
      lines.push("");
      return;
    }

    for (const child of Array.from(el.childNodes)) walk(child);
  }

  for (const child of Array.from(root.childNodes)) walk(child);

  const out = lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
  return out || txt(root);
}

function makeHook(blogText: string): string {
  const m = blogText.match(/^#\s+(.+)$/m);
  const title = m?.[1]?.trim();
  if (title) {
    const starters = ["New post:", "Quick breakdown:", "Worth reading:", "Here’s the takeaway:"];
    return `${starters[title.length % starters.length]} ${title}`;
  }

  const sents = splitSentences(blogText);
  const first = sents[0] || "Here’s a quick breakdown:";
  const short = first.length > 90 ? first.slice(0, 87).trimEnd() + "…" : first;
  const starters = ["Quick read:", "Most people miss this:", "One simple idea:", "Posting tip:"];
  return `${starters[short.length % starters.length]} ${short}`;
}

function makeBody(blogText: string): string {
  const paras = normalizeCompact(blogText).split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  const base = paras.filter((p) => !p.startsWith("#")).slice(0, 3).join(" ");
  const fallback = splitSentences(blogText).slice(0, 3).join(" ");
  const out = base || fallback;
  if (!out) return "";
  return out.length > 520 ? out.slice(0, 517).trimEnd() + "…" : out;
}

function makeBullets(blogText: string): string {
  const bulletLines = normalizeCompact(blogText)
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.startsWith("- "))
    .slice(0, 6);

  if (bulletLines.length) return bulletLines.join("\n");

  const sents = splitSentences(blogText).slice(0, 10);
  const bullets: string[] = [];
  for (const s of sents) {
    let line = s.replace(/\s+/g, " ").trim();
    if (line.length > 90) line = line.slice(0, 87).trimEnd() + "…";
    if (line.length < 18) continue;
    bullets.push(`- ${line}`);
    if (bullets.length >= 5) break;
  }

  if (!bullets.length) return "- Key insight\n- Practical step\n- Common mistake\n- Quick win\n- Next action";
  return bullets.join("\n");
}

function makeCTA(primary: Platform): string {
  switch (primary) {
    case "linkedin":
      return "If you found this useful, share your takeaway in the comments.";
    case "x":
      return "Agree? Reply with your take.";
    case "instagram":
      return "Save this for later 📌";
    case "reddit":
      return "Happy to answer questions or clarify anything.";
    case "youtube":
      return "Want more posts like this? Follow for updates.";
    case "tiktok":
      return "Save this + try it today.";
    case "facebook":
    default:
      return "If this helped, share it with someone who needs it.";
  }
}

function normalizeHashtags(text: string): string {
  const parts = normalizeCompact(text).split(/\s+/).filter(Boolean);
  const out: string[] = [];
  const seen = new Set<string>();
  for (const p of parts) {
    const tag = p.startsWith("#") ? p : "#" + p.replace(/^#+/, "");
    const key = tag.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(tag);
  }
  return out.join(" ");
}

function composeFinal(hook: string, body: string, bullets: string, cta: string, hashtags: string): string {
  const parts = [hook, body, bullets, cta, hashtags].map(normalizeCompact).filter(Boolean);
  return parts.join("\n\n").trim() + "\n";
}

function applyEmojiToggle(text: string, emoji: string): string {
  const t = text || "";
  if (t.includes(emoji)) {
    const esc = emoji.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`\\s*${esc}\\s*`, "g");
    return normalizeCompact(t.replace(re, " "));
  }
  return normalizeCompact(t + " " + emoji);
}

export function SocialPostComposerTool() {
  const [blogText, setBlogText] = useState("");

  const [hook, setHook] = useState("");
  const [body, setBody] = useState("");
  const [bullets, setBullets] = useState("");
  const [cta, setCta] = useState("");
  const [hashtags, setHashtags] = useState("");

  // ✅ Default: ALL platforms selected
  const allPlatformKeys = useMemo(() => PLATFORMS.map((p) => p.key), []);
  const [selectedPlatforms, setSelectedPlatforms] = useState<Platform[]>(allPlatformKeys);

  const [emojiQuery, setEmojiQuery] = useState("");
  const [showMoreEmoji, setShowMoreEmoji] = useState(false);

  const primaryPlatform = selectedPlatforms[0] ?? "linkedin";

  const finalPost = useMemo(
    () => composeFinal(hook, body, bullets, cta, normalizeHashtags(hashtags)),
    [hook, body, bullets, cta, hashtags]
  );

  const bytes = useMemo(() => bytesOfUtf8(finalPost), [finalPost]);
  const warnLarge = bytes > WARN_AT;
  const overCap = bytes > HARD_CAP;

  function regenerateDraft() {
    const plain = normalizeCompact(blogText);
    if (!plain) return;

    setHook(makeHook(plain));
    setBody(makeBody(plain));
    setBullets(makeBullets(plain));
    setCta(makeCTA(primaryPlatform));
  }

  function regenerateHashtags() {
    const plain = normalizeCompact(blogText);
    if (!plain) return;

    const spec = PLATFORMS.find((p) => p.key === primaryPlatform)!;
    const max = spec.maxHashtags;
    const tags = max <= 0 ? [] : generateHashtagsFromContent(plain, max);
    setHashtags(tags.join(" "));
  }

  function regenerateFinal() {
    regenerateDraft();
    regenerateHashtags();
  }

  function resetAll() {
    setBlogText("");
    setHook("");
    setBody("");
    setBullets("");
    setCta("");
    setHashtags("");
    setSelectedPlatforms(allPlatformKeys);
    setEmojiQuery("");
    setShowMoreEmoji(false);
  }

  // ✅ Live toggle platforms: instantly hides/shows previews
  function togglePlatform(p: Platform) {
    setSelectedPlatforms((prev) => {
      const has = prev.includes(p);

      // don’t allow turning off the last one (keeps UI sane)
      if (has && prev.length === 1) return prev;

      const next = has ? prev.filter((x) => x !== p) : [...prev, p];

      const order: Platform[] = ["facebook", "x", "linkedin", "instagram", "reddit", "youtube", "tiktok"];
      return next.sort((a, b) => order.indexOf(a) - order.indexOf(b));
    });
  }

  async function copyFinal() {
    if (overCap) return;
    await navigator.clipboard.writeText(finalPost);
  }

  function downloadFinal() {
    if (overCap) return;
    downloadTextFile("social-post.txt", finalPost);
  }

  function onBlogPaste(e: React.ClipboardEvent<HTMLTextAreaElement>) {
    const html = e.clipboardData.getData("text/html");
    const text = e.clipboardData.getData("text/plain");

    if (html && html.trim()) {
      e.preventDefault();
      setBlogText(htmlToStructuredText(html));
      return;
    }

    if (text && text.trim()) {
      e.preventDefault();
      setBlogText(text);
    }
  }

  const filteredEmoji = useMemo(() => {
    const q = emojiQuery.trim().toLowerCase();
    const list = !q
      ? EMOJI_LIBRARY
      : EMOJI_LIBRARY.filter((e) => e.name.includes(q) || e.tags.some((t) => t.includes(q)));

    const limit = showMoreEmoji ? 120 : 24;
    return list.slice(0, Math.min(limit, list.length));
  }, [emojiQuery, showMoreEmoji]);

  // ✅ Previews are always visible (no generate button needed)
  const previewCards = useMemo(() => {
    const selected = selectedPlatforms.length ? selectedPlatforms : allPlatformKeys;
    return selected.map((key) => {
      const spec = PLATFORMS.find((p) => p.key === key)!;
      const text = truncateChars(finalPost.trim(), spec.previewChars);
      return { key, name: spec.name, hint: spec.hint, previewChars: spec.previewChars, text };
    });
  }, [selectedPlatforms, finalPost, allPlatformKeys]);

  return (
    <div className="grid gap-6">
      {/* Blog Editor */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-sm font-semibold text-slate-900">Blog → Social Post</div>
            <div className="text-xs text-slate-500">
              Paste your blog post. HTML paste is converted into clean structured text (safe).
            </div>
          </div>

          {/* small, single-line buttons */}
          <div className="flex flex-nowrap gap-2">
            <Button type="button" onClick={regenerateDraft} className="h-8 px-2 text-xs rounded-lg whitespace-nowrap">
              Generate Draft
            </Button>
            <Button type="button" onClick={regenerateHashtags} className="h-8 px-2 text-xs rounded-lg whitespace-nowrap">
              Regenerate Hashtags
            </Button>
            <Button type="button" onClick={regenerateFinal} className="h-8 px-2 text-xs rounded-lg whitespace-nowrap">
              Regenerate Final
            </Button>
            <Button type="button" onClick={resetAll} className="h-8 px-2 text-xs rounded-lg whitespace-nowrap">
              Reset
            </Button>
          </div>
        </div>

        <div className="mt-4 grid gap-2">
          <Textarea
            value={blogText}
            onChange={(e) => setBlogText(e.target.value)}
            onPaste={onBlogPaste}
            rows={10}
            placeholder="Paste your blog post here…"
            spellCheck={false}
          />
        </div>
      </div>

      {/* Draft Blocks */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-sky-50 p-5 shadow-sm">
          <div className="text-sm font-semibold text-slate-900">🎯 Hook</div>
          <div className="mt-3">
            <Textarea value={hook} onChange={(e) => setHook(e.target.value)} rows={5} spellCheck={false} />
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-amber-50 p-5 shadow-sm">
          <div className="text-sm font-semibold text-slate-900">👉 CTA</div>
          <div className="mt-3">
            <Textarea value={cta} onChange={(e) => setCta(e.target.value)} rows={5} spellCheck={false} />
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-indigo-50 p-5 shadow-sm sm:col-span-2">
          <div className="text-sm font-semibold text-slate-900">📝 Body</div>
          <div className="mt-3">
            <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={7} spellCheck={false} />
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-emerald-50 p-5 shadow-sm">
          <div className="text-sm font-semibold text-slate-900">✅ Bullets</div>
          <div className="mt-3">
            <Textarea value={bullets} onChange={(e) => setBullets(e.target.value)} rows={7} spellCheck={false} />
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-fuchsia-50 p-5 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <div className="text-sm font-semibold text-slate-900">#️⃣ Hashtags</div>
            <Button
              type="button"
              onClick={regenerateHashtags}
              className="h-8 px-2 text-xs rounded-lg whitespace-nowrap"
            >
              Regenerate
            </Button>
          </div>
          <div className="mt-3">
            <Textarea value={hashtags} onChange={(e) => setHashtags(e.target.value)} rows={7} spellCheck={false} />
          </div>
        </div>
      </div>

      {/* Emoji Picker */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-sm font-semibold text-slate-900">Emoji Picker</div>
            <div className="text-xs text-slate-500">Click to toggle emojis into the Hook.</div>
          </div>
          <Button
            type="button"
            onClick={() => setShowMoreEmoji((v) => !v)}
            className="h-8 px-2 text-xs rounded-lg whitespace-nowrap"
          >
            {showMoreEmoji ? "Show less" : "Show more"}
          </Button>
        </div>

        <div className="mt-3 grid gap-3">
          <input
            className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm"
            value={emojiQuery}
            onChange={(e) => setEmojiQuery(e.target.value)}
            placeholder="Search emoji (fire, rocket, growth)…"
            spellCheck={false}
          />

          <div className="flex flex-wrap gap-2">
            {filteredEmoji.map((e) => {
              const active = hook.includes(e.emoji);
              return (
                <Button
                  key={e.emoji}
                  type="button"
                  onClick={() => setHook((prev) => applyEmojiToggle(prev, e.emoji))}
                  className={
                    "h-8 px-2 text-xs rounded-lg whitespace-nowrap " +
                    (active ? "border-emerald-500 bg-emerald-50" : "")
                  }
                  aria-pressed={active}
                >
                  {e.emoji} {e.name}
                </Button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Final Post */}
      <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-sm font-semibold text-slate-900">Final Composed Post</div>
            <div className="text-xs text-slate-600">This is what gets copied/downloaded.</div>
          </div>
          <div className="flex flex-nowrap gap-2 overflow-x-auto">
            <Button type="button" onClick={regenerateFinal} className="h-8 px-2 text-xs rounded-lg whitespace-nowrap">
              Regenerate
            </Button>
            <Button
              type="button"
              onClick={copyFinal}
              disabled={overCap}
              className="h-8 px-2 text-xs rounded-lg whitespace-nowrap"
            >
              Copy
            </Button>
            <Button
              type="button"
              onClick={downloadFinal}
              disabled={overCap}
              className="h-8 px-2 text-xs rounded-lg whitespace-nowrap"
            >
              Download
            </Button>
          </div>
        </div>

        <div className="mt-3">
          <Textarea value={finalPost} readOnly rows={10} />
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-600">
          <div>
            Size: <span className="font-mono">{formatBytes(bytes)}</span>
            {warnLarge ? " • Large" : ""}
          </div>
          {overCap ? <div className="text-rose-700">Over 5MB cap. Reduce content.</div> : null}
        </div>
      </div>

      {/* Choose platforms (LIVE toggles) */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-sm font-semibold text-slate-900">Choose platforms</div>
            <div className="text-xs text-slate-500">
              Previews update instantly. Active buttons are highlighted.
            </div>
          </div>

          <div className="flex flex-nowrap gap-2 overflow-x-auto">
            <Button
              type="button"
              onClick={() => setSelectedPlatforms(allPlatformKeys)}
              className="h-8 px-2 text-xs rounded-lg whitespace-nowrap"
            >
              Select all
            </Button>
            <Button
              type="button"
              onClick={() => setSelectedPlatforms(["linkedin"])}
              className="h-8 px-2 text-xs rounded-lg whitespace-nowrap"
            >
              LinkedIn only
            </Button>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {PLATFORMS.map((p) => {
            const active = selectedPlatforms.includes(p.key);
            return (
              <Button
                key={p.key}
                type="button"
                onClick={() => togglePlatform(p.key)}
                className={
                  "h-9 px-3 text-sm rounded-xl whitespace-nowrap " +
                  (active ? "border-emerald-500 bg-emerald-50" : "border-slate-200 bg-white")
                }
                aria-pressed={active}
              >
                {p.name}
              </Button>
            );
          })}
        </div>
      </div>

      {/* Preview simulator (ALWAYS on) */}
      <div className="rounded-2xl border border-sky-200 bg-sky-50 p-5">
        <div className="text-sm font-semibold text-slate-900">Preview Simulator</div>
        <div className="text-xs text-slate-600">Approximation. Platforms may render differently.</div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {previewCards.map((p) => (
            <div key={p.key} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm font-semibold text-slate-900">{p.name}</div>
                <div className="text-xs text-slate-500">{p.previewChars} preview chars</div>
              </div>

              <div className="mt-2 whitespace-pre-wrap text-sm text-slate-800">{p.text}</div>

              <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                <div className="text-xs text-slate-500">{p.hint}</div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    onClick={() => navigator.clipboard.writeText(p.text)}
                    className="h-8 px-2 text-xs rounded-lg whitespace-nowrap"
                  >
                    Copy
                  </Button>
                  <Button
                    type="button"
                    onClick={() => downloadTextFile(`preview-${p.key}.txt`, p.text)}
                    className="h-8 px-2 text-xs rounded-lg whitespace-nowrap"
                  >
                    Download
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {previewCards.length === 0 ? (
          <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
            Turn on at least one platform.
          </div>
        ) : null}
      </div>
    </div>
  );
}