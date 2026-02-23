import type { ComponentType } from "react";
import { JsonFormatterTool } from "../tools/dev/JsonFormatterTool";
import { UrlTool } from "../tools/dev/UrlTool";
import { Base64Tool } from "../tools/dev/Base64Tool";
import { IdGeneratorTool } from "../tools/dev/IdGeneratorTool";
import { HashGeneratorTool } from "../tools/dev/HashGeneratorTool";
import { JwtInspectorTool } from "../tools/dev/JwtInspectorTool";
import { RegexSuiteTool } from "../tools/dev/RegexSuiteTool";
import { JsonTableTool } from "../tools/dev/JsonTableTool";
import { CsvJsonConverterTool } from "../tools/data/CsvJsonConverterTool";
import { WhitespaceNormalizerTool } from "../tools/data/WhitespaceNormalizerTool";
import { ExtractorsPackTool } from "../tools/data/ExtractorsPackTool";
import { MetaPreviewTool } from "../tools/seo/MetaPreviewTool";
import { SchemaGeneratorTool } from "../tools/seo/SchemaGeneratorTool";
import { HeadlineAnalyzerTool } from "../tools/seo/HeadlineAnalyzerTool";
import { KeywordGrouperTool } from "../tools/seo/KeywordGrouperTool";
import { SmartCounterTool } from "../tools/writing/SmartCounterTool";
import { TranscriptCleanerTool } from "../tools/writing/TranscriptCleanerTool";
import { TextConverterTool } from "../tools/writing/TextConverterTool";
import { DummyTextGeneratorTool } from "../tools/writing/DummyTextGeneratorTool";
import { TextUtilitiesTool } from "../tools/writing/TextUtilitiesTool";
import { SocialPostComposerTool } from "../tools/social/SocialPostComposerTool";
import { WorkflowBuilderTool } from "../tools/workflows/WorkflowBuilderTool";

export type ToolCategory =
  | "Dev"
  | "SEO/Marketing"
  | "Writing"
  | "Data/Cleaning"
  | "Security"
  | "Social"
  | "Workflows";

export type ToolConfig<TState = unknown> = {
  id: string;
  category: ToolCategory;
  name: string;
  description: string;
  keywords: string[];
  Component: ComponentType;
  defaultState: TState;
};

export const CATEGORIES: ToolCategory[] = [
  "Dev",
  "SEO/Marketing",
  "Writing",
  "Data/Cleaning",
  "Security",
  "Social",
  "Workflows",
];

export const toolsRegistry: ToolConfig[] = [
  {
    id: "dev/json-formatter",
    category: "Dev",
    name: "JSON Formatter + Validator",
    description: "Pretty print, minify, sort keys, and validate JSON safely.",
    keywords: ["json", "format", "validator", "prettify", "minify", "sort keys"],
    Component: JsonFormatterTool,
    defaultState: {},
  },
  {
    id: "dev/url-encode-decode",
    category: "Dev",
    name: "URL Encode/Decode + Query Parser",
    description: "Encode/decode URLs, parse query params, remove params, and rebuild clean URLs.",
    keywords: ["url", "encode", "decode", "query", "params", "utm", "querystring"],
    Component: UrlTool,
    defaultState: {},
  },
  {
    id: "dev/base64",
    category: "Dev",
    name: "Base64 Encode/Decode",
    description: "Encode/decode Base64 safely. Includes validation and optional Data URL helper.",
    keywords: ["base64", "encode", "decode", "data url", "utf-8", "validator"],
    Component: Base64Tool,
    defaultState: {},
  },
  {
    id: "dev/id-generator",
    category: "Dev",
    name: "UUID + NanoID Generator",
    description: "Generate UUID v4 and NanoIDs locally using Web Crypto (single or bulk).",
    keywords: ["uuid", "nanoid", "generator", "bulk", "random", "crypto"],
    Component: IdGeneratorTool,
    defaultState: {},
  },
  {
    id: "dev/hash-generator",
    category: "Dev",
    name: "Hash Generator (SHA-256 / SHA-512)",
    description: "Generate SHA-256 and SHA-512 hashes locally using the Web Crypto API.",
    keywords: ["hash", "sha256", "sha512", "crypto", "digest", "checksum"],
    Component: HashGeneratorTool,
    defaultState: {},
  },
  {
    id: "dev/jwt-inspector",
    category: "Dev",
    name: "JWT Decoder / Inspector",
    description: "Decode JWT header/payload locally and inspect claims (no signature verification).",
    keywords: ["jwt", "token", "decode", "inspector", "exp", "claims", "base64url"],
    Component: JwtInspectorTool,
    defaultState: {},
  },
  {
    id: "dev/regex-suite",
    category: "Dev",
    name: "Regex Suite",
    description: "Test patterns, highlight matches, inspect groups, and use common regex templates.",
    keywords: ["regex", "regexp", "match", "highlight", "groups", "escape", "unescape"],
    Component: RegexSuiteTool,
    defaultState: {},
  },
  {
    id: "dev/json-to-table",
    category: "Dev",
    name: "JSON to Table Viewer",
    description: "Render JSON data in a searchable table with column filters.",
    keywords: ["json", "table", "viewer", "search", "filter", "rows", "columns"],
    Component: JsonTableTool,
    defaultState: {},
  },
  {
    id: "data/csv-json",
    category: "Data/Cleaning",
    name: "CSV/TSV ↔ JSON Converter",
    description: "Convert CSV/TSV to JSON and JSON to CSV locally (auto delimiter, header support).",
    keywords: ["csv", "tsv", "json", "convert", "delimiter", "data cleaning"],
    Component: CsvJsonConverterTool,
    defaultState: {},
  },
  {
    id: "data/whitespace-normalizer",
    category: "Data/Cleaning",
    name: "Whitespace & Line Ending Normalizer",
    description:
      "Normalize line endings and whitespace safely (CRLF/LF, trim, remove trailing spaces, collapse blanks).",
    keywords: ["whitespace", "line endings", "crlf", "lf", "trim", "normalize", "cleanup"],
    Component: WhitespaceNormalizerTool,
    defaultState: {},
  },
  {
    id: "data/extractors-pack",
    category: "Data/Cleaning",
    name: "Extractors Pack",
    description: "Extract emails, URLs, or hashtags from text locally.",
    keywords: ["extract", "emails", "urls", "hashtags", "dedupe", "unique"],
    Component: ExtractorsPackTool,
    defaultState: {},
  },
  {
    id: "seo/meta-preview",
    category: "SEO/Marketing",
    name: "Meta Tag Previewer (OG/Twitter)",
    description: "Generate meta tags + Open Graph/Twitter snippets and preview how they may appear (approx).",
    keywords: ["meta", "seo", "open graph", "og", "twitter", "preview", "canonical"],
    Component: MetaPreviewTool,
    defaultState: {},
  },
  {
    id: "seo/schema-generator",
    category: "SEO/Marketing",
    name: "Schema Markup Generator (JSON-LD)",
    description:
      "Generate JSON-LD schema for common templates (Article, FAQ, HowTo, Product, LocalBusiness).",
    keywords: ["schema", "json-ld", "structured data", "article", "faq", "howto", "product", "localbusiness"],
    Component: SchemaGeneratorTool,
    defaultState: {},
  },
  {
    id: "seo/headline-analyzer",
    category: "SEO/Marketing",
    name: "Headline Analyzer + Variants",
    description: "Analyze headline metrics and generate 10 deterministic variants (no AI).",
    keywords: ["headline", "seo", "title", "variants", "readability", "copywriting"],
    Component: HeadlineAnalyzerTool,
    defaultState: {},
  },
  {
    id: "seo/keyword-grouper",
    category: "SEO/Marketing",
    name: "Keyword Grouper / Categorizer",
    description: "Group keywords by search intent and shared stems (heuristic).",
    keywords: ["keywords", "seo", "intent", "group", "categorize", "stems"],
    Component: KeywordGrouperTool,
    defaultState: {},
  },
  {
    id: "writing/smart-counter",
    category: "Writing",
    name: "Smart Word/Character Counter",
    description: "Count words, characters, sentences, paragraphs, reading and speaking time with smart exclusions.",
    keywords: ["word count", "character count", "sentences", "paragraphs", "reading time", "speaking time"],
    Component: SmartCounterTool,
    defaultState: {},
  },
  {
    id: "writing/transcript-cleaner",
    category: "Writing",
    name: "Transcript Cleaner",
    description: "Clean transcripts: remove timestamps, normalize speakers, remove filler words, normalize whitespace.",
    keywords: ["transcript", "timestamps", "speaker", "clean", "filler words", "whitespace"],
    Component: TranscriptCleanerTool,
    defaultState: {},
  },
  {
    id: "writing/text-converter",
    category: "Writing",
    name: "Text Converter (All-in-One)",
    description: "Convert case + clean text + remove characters. Runs locally.",
    keywords: ["convert case", "text cleanup", "remove characters", "sort lines", "dedupe lines", "line numbers"],
    Component: TextConverterTool,
    defaultState: {},
  },
  {
    id: "writing/dummy-text",
    category: "Writing",
    name: "Dummy Text Generator",
    description: "Generate lorem ipsum or random dummy text by words or paragraphs.",
    keywords: ["lorem ipsum", "dummy text", "placeholder", "random text", "generator"],
    Component: DummyTextGeneratorTool,
    defaultState: {},
  },
  {
    id: "writing/text-utilities",
    category: "Writing",
    name: "Text Utilities (Advanced)",
    description: "Extra text utilities: reverse, sort, dedupe, line tools, remove HTML tags, find/replace (plain).",
    keywords: ["reverse text", "sort lines", "dedupe lines", "remove html tags", "find replace", "line numbers"],
    Component: TextUtilitiesTool,
    defaultState: {},
  },
  {
    id: "social/post-composer",
    category: "Social",
    name: "Social Post Composer",
    description: "Compose and format posts with Unicode styles + preview simulators (runs locally).",
    keywords: ["social", "post", "linkedin", "twitter", "instagram", "preview", "unicode bold", "emoji"],
    Component: SocialPostComposerTool,
    defaultState: {},
  },

  // ✅ NEW: Workflows
  {
    id: "workflows/builder",
    category: "Workflows",
    name: "Workflow Builder",
    description: "Chain multiple transforms into a repeatable workflow (local-only).",
    keywords: ["workflow", "pipeline", "chain", "steps", "preset"],
    Component: WorkflowBuilderTool,
    defaultState: {},
  },
];

export function getToolById(id: string): ToolConfig | undefined {
  return toolsRegistry.find((t) => t.id === id);
}

export function toolsByCategory(): Map<ToolCategory, ToolConfig[]> {
  const map = new Map<ToolCategory, ToolConfig[]>();
  for (const cat of CATEGORIES) map.set(cat, []);
  for (const tool of toolsRegistry) map.get(tool.category)!.push(tool);
  return map;
} 
