<<<<<<< HEAD
const STOPWORDS = new Set([
  "a","an","the","and","or","but","if","then","else","when","while","to","of","in","on","for","from","with","without",
  "is","are","was","were","be","been","being","it","this","that","these","those","as","at","by","we","you","they","i",
  "my","your","our","their","me","us","them","not","no","yes","do","does","did","done","can","could","should","would",
  "will","just","very","more","most","less","many","much","some","any","each","all"
]);

function normalizeText(t: string): string {
  return (t || "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .toLowerCase();
}

function tokenize(t: string): string[] {
  // words + simple hyphen support
  const m = normalizeText(t).match(/[a-z0-9]+(?:-[a-z0-9]+)*/g);
  return m ? m : [];
}

function scoreKeywords(tokens: string[]): Map<string, number> {
  const freq = new Map<string, number>();
  for (const tok of tokens) {
    if (tok.length < 3) continue;
    if (STOPWORDS.has(tok)) continue;
    // remove pure numbers unless meaningful (>=3 digits)
    if (/^\d+$/.test(tok) && tok.length < 3) continue;

    freq.set(tok, (freq.get(tok) ?? 0) + 1);
  }

  // boost some patterns
  const scored = new Map<string, number>();
  for (const [k, v] of freq.entries()) {
    let s = v;
    if (k.includes("-")) s += 1;        // hyphenated keywords are often specific
    if (k.length >= 8) s += 1;          // longer tends to be more specific
    scored.set(k, s);
  }

  return scored;
}

function toHashtag(word: string): string {
  // Convert "web-dev" -> "WebDev", "json" -> "Json"
  const parts = word.split("-").filter(Boolean);
  const camel = parts.map(p => p.charAt(0).toUpperCase() + p.slice(1)).join("");
  return "#" + camel;
}

export function generateHashtagsFromContent(content: string, limit = 10): string[] {
  const tokens = tokenize(content);
  const scores = scoreKeywords(tokens);

  const sorted = Array.from(scores.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([k]) => k);

  const tags: string[] = [];
  for (const k of sorted) {
    const tag = toHashtag(k);
    // dedupe case-insensitive
    if (tags.some(t => t.toLowerCase() === tag.toLowerCase())) continue;
    tags.push(tag);
    if (tags.length >= limit) break;
  }

  // Add a few safe “general” tags only if space remains and content hints it.
  const c = normalizeText(content);
  const general: string[] = [];
  if (c.includes("seo")) general.push("#SEO");
  if (c.includes("json")) general.push("#JSON");
  if (c.includes("csv")) general.push("#CSV");
  if (c.includes("regex")) general.push("#Regex");
  if (c.includes("tool") || c.includes("tools")) general.push("#Tools");
  if (c.includes("developer") || c.includes("dev")) general.push("#WebDev");
  if (c.includes("productivity")) general.push("#Productivity");

  for (const g of general) {
    if (tags.length >= limit) break;
    if (tags.some(t => t.toLowerCase() === g.toLowerCase())) continue;
    tags.push(g);
  }

  return tags.slice(0, limit);
=======
const STOPWORDS = new Set([
  "a","an","the","and","or","but","if","then","else","when","while","to","of","in","on","for","from","with","without",
  "is","are","was","were","be","been","being","it","this","that","these","those","as","at","by","we","you","they","i",
  "my","your","our","their","me","us","them","not","no","yes","do","does","did","done","can","could","should","would",
  "will","just","very","more","most","less","many","much","some","any","each","all"
]);

function normalizeText(t: string): string {
  return (t || "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .toLowerCase();
}

function tokenize(t: string): string[] {
  // words + simple hyphen support
  const m = normalizeText(t).match(/[a-z0-9]+(?:-[a-z0-9]+)*/g);
  return m ? m : [];
}

function scoreKeywords(tokens: string[]): Map<string, number> {
  const freq = new Map<string, number>();
  for (const tok of tokens) {
    if (tok.length < 3) continue;
    if (STOPWORDS.has(tok)) continue;
    // remove pure numbers unless meaningful (>=3 digits)
    if (/^\d+$/.test(tok) && tok.length < 3) continue;

    freq.set(tok, (freq.get(tok) ?? 0) + 1);
  }

  // boost some patterns
  const scored = new Map<string, number>();
  for (const [k, v] of freq.entries()) {
    let s = v;
    if (k.includes("-")) s += 1;        // hyphenated keywords are often specific
    if (k.length >= 8) s += 1;          // longer tends to be more specific
    scored.set(k, s);
  }

  return scored;
}

function toHashtag(word: string): string {
  // Convert "web-dev" -> "WebDev", "json" -> "Json"
  const parts = word.split("-").filter(Boolean);
  const camel = parts.map(p => p.charAt(0).toUpperCase() + p.slice(1)).join("");
  return "#" + camel;
}

export function generateHashtagsFromContent(content: string, limit = 10): string[] {
  const tokens = tokenize(content);
  const scores = scoreKeywords(tokens);

  const sorted = Array.from(scores.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([k]) => k);

  const tags: string[] = [];
  for (const k of sorted) {
    const tag = toHashtag(k);
    // dedupe case-insensitive
    if (tags.some(t => t.toLowerCase() === tag.toLowerCase())) continue;
    tags.push(tag);
    if (tags.length >= limit) break;
  }

  // Add a few safe “general” tags only if space remains and content hints it.
  const c = normalizeText(content);
  const general: string[] = [];
  if (c.includes("seo")) general.push("#SEO");
  if (c.includes("json")) general.push("#JSON");
  if (c.includes("csv")) general.push("#CSV");
  if (c.includes("regex")) general.push("#Regex");
  if (c.includes("tool") || c.includes("tools")) general.push("#Tools");
  if (c.includes("developer") || c.includes("dev")) general.push("#WebDev");
  if (c.includes("productivity")) general.push("#Productivity");

  for (const g of general) {
    if (tags.length >= limit) break;
    if (tags.some(t => t.toLowerCase() === g.toLowerCase())) continue;
    tags.push(g);
  }

  return tags.slice(0, limit);
>>>>>>> a38c6781ba02f0335e4b9de11228d87416afd174
}