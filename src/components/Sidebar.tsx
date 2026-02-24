// src/components/Sidebar.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import { CATEGORIES, type ToolCategory, toolsByCategory, toolsRegistry } from "../app/toolsRegistry";
import { storage } from "../lib/storage";
import { Input } from "./ui/Input";
import { IconButton } from "./ui/IconButton";

const LS_PINNED = "tt:pinnedToolIds";
const LS_CATEGORY_COLLAPSE = "tt:collapsedCategories";

type Props = {
  activeToolId: string;
  onOpenTool: (id: string) => void;
  mobileOpen: boolean;
  onMobileOpenChange: (v: boolean) => void;
};

type CollapseState = Record<ToolCategory, boolean>;

function defaultCollapse(): CollapseState {
  return {
    Dev: false,
    "SEO/Marketing": false,
    Writing: false,
    "Data/Cleaning": false,
    Security: false,
    Social: false,
    Workflows: false,
  };
}

/** Category color identity */
const CATEGORY_STYLES: Record<ToolCategory, { bg: string; text: string; border: string; dot: string }> = {
  Dev: { bg: "#EEF2FF", text: "#3730A3", border: "#6366F1", dot: "#6366F1" },
  "Data/Cleaning": { bg: "#ECFDF5", text: "#065F46", border: "#10B981", dot: "#10B981" },
  Writing: { bg: "#F5F3FF", text: "#5B21B6", border: "#8B5CF6", dot: "#8B5CF6" },
  "SEO/Marketing": { bg: "#FFFBEB", text: "#92400E", border: "#F59E0B", dot: "#F59E0B" },
  Security: { bg: "#FEF2F2", text: "#991B1B", border: "#EF4444", dot: "#EF4444" },
  Social: { bg: "#F0F9FF", text: "#075985", border: "#0EA5E9", dot: "#0EA5E9" },
  Workflows: { bg: "#EFF6FF", text: "#1E3A8A", border: "#3B82F6", dot: "#3B82F6" },
};

function CategoryHeader({
  category,
  collapsed,
  onToggle,
}: {
  category: ToolCategory;
  collapsed: boolean;
  onToggle: () => void;
}) {
  const s = CATEGORY_STYLES[category];

  return (
    <button
      className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left transition hover:opacity-95"
      onClick={onToggle}
      aria-expanded={!collapsed}
      style={{
        background: s.bg,
        color: s.text,
        borderLeft: `4px solid ${s.border}`,
      }}
    >
      <div className="flex items-center gap-2 min-w-0">
        <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: s.dot }} />
        <span className="truncate text-[15px] font-bold uppercase tracking-wider">{category}</span>
      </div>

      <span style={{ color: s.text, opacity: 0.85 }} className="text-sm">
        {collapsed ? "▸" : "▾"}
      </span>
    </button>
  );
}

/** Cancelable smooth scroll helper */
function animateScrollLeft(
  el: HTMLElement,
  to: number,
  durationMs: number,
  rafRef: React.MutableRefObject<number | null>
) {
  if (rafRef.current) {
    cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
  }

  const start = el.scrollLeft;
  const delta = to - start;
  if (Math.abs(delta) < 1) return;

  const startTime = performance.now();

  const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

  const tick = (now: number) => {
    const t = Math.min(1, (now - startTime) / durationMs);
    el.scrollLeft = start + delta * easeInOut(t);

    if (t < 1) {
      rafRef.current = requestAnimationFrame(tick);
    } else {
      rafRef.current = null;
    }
  };

  rafRef.current = requestAnimationFrame(tick);
}

/**
 * Title scroll-in-place (no tooltip):
 * - Ellipsis normally
 * - On hover: ellipsis off + scroll to end
 * - On leave: cancel + snap/scroll back so it never gets stuck
 */
function HoverScrollName({
  text,
  className = "",
  speed = 520,
}: {
  text: string;
  className?: string;
  speed?: number;
}) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const innerRef = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const hoverStartedAt = useRef<number>(0);

  const [overflowing, setOverflowing] = useState(false);

  useEffect(() => {
    const wrap = wrapRef.current;
    const inner = innerRef.current;
    if (!wrap || !inner) return;

    const check = () => {
      const over = inner.scrollWidth > wrap.clientWidth + 1;
      setOverflowing(over);

      // If it stops overflowing due to resize, reset
      if (!over) {
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
        wrap.classList.remove("tt-marquee-hover");
        wrap.scrollLeft = 0;
      }
    };

    check();
    const ro = new ResizeObserver(check);
    ro.observe(wrap);
    ro.observe(inner);
    return () => ro.disconnect();
  }, [text]);

  function stopAnimation() {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }

  function resetImmediately() {
    const wrap = wrapRef.current;
    if (!wrap) return;
    stopAnimation();
    wrap.scrollLeft = 0;
    wrap.classList.remove("tt-marquee-hover");
  }

  function onEnter() {
    const wrap = wrapRef.current;
    const inner = innerRef.current;
    if (!wrap || !inner) return;

    hoverStartedAt.current = performance.now();
    stopAnimation();

    if (!overflowing) return;

    wrap.classList.add("tt-marquee-hover");

    const maxScroll = Math.max(0, inner.scrollWidth - wrap.clientWidth);
    animateScrollLeft(wrap, maxScroll, speed, rafRef);
  }

  function onLeave() {
    const wrap = wrapRef.current;
    if (!wrap) return;

    const hoverMs = performance.now() - hoverStartedAt.current;

    stopAnimation();

    // Very fast hover -> snap back (prevents stuck mid-scroll)
    if (hoverMs < 120) {
      resetImmediately();
      return;
    }

    animateScrollLeft(wrap, 0, 240, rafRef);

    window.setTimeout(() => {
      wrap.classList.remove("tt-marquee-hover");
    }, 120);
  }

  useEffect(() => {
    return () => stopAnimation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      ref={wrapRef}
      className={"tt-marquee-wrap " + className}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      title={text}
    >
      <div ref={innerRef} className="tt-marquee-inner">
        {text}
      </div>
    </div>
  );
}

export function Sidebar(props: Props) {
  const { activeToolId, onOpenTool, mobileOpen, onMobileOpenChange } = props;

  const [query, setQuery] = useState("");
  const [pinned, setPinned] = useState<string[]>(() => storage.getJSON<string[]>(LS_PINNED) ?? []);
  const [collapsed, setCollapsed] = useState<CollapseState>(
    () => storage.getJSON<CollapseState>(LS_CATEGORY_COLLAPSE) ?? defaultCollapse()
  );

  const searchRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName?.toLowerCase();
      const isTypingSurface =
        tag === "input" ||
        tag === "textarea" ||
        (e.target as HTMLElement | null)?.isContentEditable;

      if (!isTypingSurface && e.key === "/") {
        e.preventDefault();
        searchRef.current?.focus();
        return;
      }

      if (e.key === "Escape") {
        if (document.activeElement === searchRef.current) {
          e.preventDefault();
          setQuery("");
        }
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => storage.setJSON(LS_PINNED, pinned), [pinned]);
  useEffect(() => storage.setJSON(LS_CATEGORY_COLLAPSE, collapsed), [collapsed]);

  const toolsMap = useMemo(() => toolsByCategory(), []);
  const normalizedQuery = query.trim().toLowerCase();

  const filteredTools = useMemo(() => {
    if (!normalizedQuery) return toolsRegistry;

    return toolsRegistry.filter((t) => {
      const hay = [t.name, t.description, t.category, ...t.keywords].join(" ").toLowerCase();
      return hay.includes(normalizedQuery);
    });
  }, [normalizedQuery]);

  function togglePin(toolId: string) {
    setPinned((prev) => (prev.includes(toolId) ? prev.filter((id) => id !== toolId) : [toolId, ...prev]));
  }

  const pinnedTools = useMemo(() => {
    const set = new Set(pinned);
    return toolsRegistry.filter((t) => set.has(t.id));
  }, [pinned]);

  const Drawer = (
    <aside className="flex h-full flex-col rounded-2xl border border-slate-200 bg-white shadow-soft">
      <div className="border-b border-slate-200 p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[26px] font-semibold text-slate-900">Text Toolkit</div>
            <div className="text-[13px] text-slate-500">All tools run locally (no uploads)</div>
          </div>

          <div className="md:hidden">
            <IconButton aria-label="Close menu" onClick={() => onMobileOpenChange(false)} title="Close">
              ✕
            </IconButton>
          </div>
        </div>

        <div className="mt-4">
          <Input
            ref={searchRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search tools…  (press /)"
            aria-label="Search tools"
          />
          <div className="mt-2 text-[13px] text-slate-500">
            Shortcuts: <span className="font-mono">/</span> search • <span className="font-mono">Esc</span> clear •{" "}
            <span className="font-mono">↑/↓</span> select • <span className="font-mono">Enter</span> open
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto p-3">
        <div className="mb-4">
          <div className="px-2 pb-2 text-[13px] font-bold uppercase tracking-wide text-slate-500">
            Pinned / Most used
          </div>

          {pinnedTools.length === 0 ? (
            <div className="px-2 text-[14px] text-slate-600">Pin tools to keep them here.</div>
          ) : (
            <div role="listbox" aria-label="Pinned tools" className="flex flex-col gap-1">
              {pinnedTools.map((t) => (
                <ToolRow
                  key={t.id}
                  id={t.id}
                  name={t.name}
                  category={t.category as ToolCategory}
                  active={t.id === activeToolId}
                  pinned
                  onPin={() => togglePin(t.id)}
                  onOpen={() => onOpenTool(t.id)}
                />
              ))}
            </div>
          )}
        </div>

        {normalizedQuery ? (
          <div>
            <div className="px-2 pb-2 text-[13px] font-bold uppercase tracking-wide text-slate-500">Results</div>
            <div role="listbox" aria-label="Tool results" className="flex flex-col gap-1">
              {filteredTools.map((t) => (
                <ToolRow
                  key={t.id}
                  id={t.id}
                  name={t.name}
                  category={t.category as ToolCategory}
                  active={t.id === activeToolId}
                  pinned={pinned.includes(t.id)}
                  onPin={() => togglePin(t.id)}
                  onOpen={() => onOpenTool(t.id)}
                />
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {CATEGORIES.map((cat) => {
              const isCollapsed = collapsed[cat];
              const tools = toolsMap.get(cat) ?? [];

              return (
                <div key={cat}>
                  <CategoryHeader
                    category={cat}
                    collapsed={isCollapsed}
                    onToggle={() => setCollapsed((prev) => ({ ...prev, [cat]: !prev[cat] }))}
                  />

                  {!isCollapsed && (
                    <div className="mt-2 ml-3 rounded-xl border border-slate-200 bg-white/70 p-2">
                      <div role="listbox" aria-label={`${cat} tools`} className="flex flex-col gap-1">
                        {tools.map((t) => (
                          <ToolRow
                            key={t.id}
                            id={t.id}
                            name={t.name}
                            category={t.category as ToolCategory}
                            active={t.id === activeToolId}
                            pinned={pinned.includes(t.id)}
                            onPin={() => togglePin(t.id)}
                            onOpen={() => onOpenTool(t.id)}
                            nested
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="border-t border-slate-200 p-4 text-[13px] text-slate-500">
        Tip: use hash links like <span className="font-mono">/#dev/json-formatter</span>
      </div>
    </aside>
  );

  return (
    <>
      <div className="mb-4 flex items-center justify-between md:hidden">
        <div className="text-[17px] font-semibold text-slate-900">Text Toolkit</div>
        <IconButton aria-label="Open menu" onClick={() => onMobileOpenChange(true)} title="Menu">
          ☰
        </IconButton>
      </div>

      <div className="hidden md:block">
        <div className="sticky top-6 h-[calc(100dvh-48px)]">{Drawer}</div>
      </div>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true">
          <button
            className="absolute inset-0 bg-slate-900/30"
            aria-label="Close overlay"
            onClick={() => onMobileOpenChange(false)}
          />
          <div className="absolute left-3 top-3 h-[calc(100dvh-24px)] w-[min(92vw,360px)]">{Drawer}</div>
        </div>
      )}
    </>
  );
}

function ToolRow({
  id,
  name,
  category,
  active,
  pinned,
  onPin,
  onOpen,
  nested = false,
}: {
  id: string;
  name: string;
  category: ToolCategory;
  active: boolean;
  pinned: boolean;
  onPin: () => void;
  onOpen: () => void;
  nested?: boolean;
}) {
  const s = CATEGORY_STYLES[category];

  return (
    <div
      id={id}
      role="option"
      aria-selected={active}
      className={[
        "group flex items-center justify-between gap-3 rounded-xl border px-3 py-2 transition",
        nested ? "pl-2" : "",
        active ? "border-blue-600 bg-blue-50" : "border-transparent hover:border-slate-200 hover:bg-slate-50",
      ].join(" ")}
    >
      <button onClick={onOpen} className="min-w-0 flex-1 text-left" aria-label={`Open ${name}`}>
        <div className="flex items-center gap-2 min-w-0">
          <span className="inline-block h-2.5 w-2.5 rounded-full flex-none" style={{ background: s.dot }} />

          {/* title scrolls in place on hover */}
          <HoverScrollName text={name} className="text-[14px] font-semibold text-slate-900 min-w-0" />
        </div>

        <div className="truncate text-[13px] text-slate-500">{category}</div>
      </button>

      <button
        type="button"
        className={[
          "rounded-lg px-2 py-1 text-[12px] font-semibold transition",
          pinned ? "text-blue-700" : "text-slate-500",
          "hover:bg-white hover:shadow-sm",
        ].join(" ")}
        onClick={onPin}
        aria-label={pinned ? "Unpin tool" : "Pin tool"}
        title={pinned ? "Unpin" : "Pin"}
      >
        {pinned ? "★" : "☆"}
      </button>
    </div>
  );
}