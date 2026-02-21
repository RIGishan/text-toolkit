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
    "Dev": false,
    "SEO/Marketing": false,
    "Writing": false,
    "Data/Cleaning": false,
    "Security": false,
    "Social": false
  };
}

export function Sidebar(props: Props) {
  const { activeToolId, onOpenTool, mobileOpen, onMobileOpenChange } = props;

  const [query, setQuery] = useState("");
  const [pinned, setPinned] = useState<string[]>(
    () => storage.getJSON<string[]>(LS_PINNED) ?? []
  );
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
      const hay = [t.name, t.description, t.category, ...t.keywords]
        .join(" ")
        .toLowerCase();
      return hay.includes(normalizedQuery);
    });
  }, [normalizedQuery]);

  const listTools = useMemo(() => {
    return normalizedQuery ? filteredTools : toolsRegistry;
  }, [normalizedQuery, filteredTools]);

  const [activeIndex, setActiveIndex] = useState<number>(() => {
    const idx = listTools.findIndex((t) => t.id === activeToolId);
    return idx >= 0 ? idx : 0;
  });

  useEffect(() => {
    const idx = listTools.findIndex((t) => t.id === activeToolId);
    if (idx >= 0) setActiveIndex(idx);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeToolId, normalizedQuery]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const focusIsSearch = document.activeElement === searchRef.current;
      const allow =
        focusIsSearch ||
        mobileOpen ||
        window.matchMedia("(min-width: 768px)").matches;
      if (!allow) return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((i) => Math.min(i + 1, listTools.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter") {
        const t = listTools[activeIndex];
        if (t) {
          e.preventDefault();
          onOpenTool(t.id);
        }
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeIndex, listTools, onOpenTool, mobileOpen]);

  function togglePin(toolId: string) {
    setPinned((prev) =>
      prev.includes(toolId) ? prev.filter((id) => id !== toolId) : [toolId, ...prev]
    );
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
            <div className="text-sm font-semibold text-slate-900">Text Toolkit</div>
            <div className="text-xs text-slate-500">All tools run locally (no uploads)</div>
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
          <div className="mt-2 text-xs text-slate-500">
            Shortcuts: <span className="font-mono">/</span> search •{" "}
            <span className="font-mono">Esc</span> clear •{" "}
            <span className="font-mono">↑/↓</span> select •{" "}
            <span className="font-mono">Enter</span> open
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto p-3">
        <div className="mb-4">
          <div className="px-2 pb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Pinned / Most used
          </div>

          {pinnedTools.length === 0 ? (
            <div className="px-2 text-sm text-slate-600">Pin tools to keep them here.</div>
          ) : (
            <div role="listbox" aria-label="Pinned tools" className="flex flex-col gap-1">
              {pinnedTools.map((t) => (
                <ToolRow
                  key={t.id}
                  id={t.id}
                  name={t.name}
                  category={t.category}
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
            <div className="px-2 pb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Results</div>
            <div
              role="listbox"
              aria-label="Tool results"
              aria-activedescendant={listTools[activeIndex]?.id}
              className="flex flex-col gap-1"
            >
              {filteredTools.map((t) => (
                <ToolRow
                  key={t.id}
                  id={t.id}
                  name={t.name}
                  category={t.category}
                  active={t.id === listTools[activeIndex]?.id}
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
                  <button
                    className="flex w-full items-center justify-between rounded-xl px-2 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 hover:bg-slate-50"
                    onClick={() => setCollapsed((prev) => ({ ...prev, [cat]: !prev[cat] }))}
                    aria-expanded={!isCollapsed}
                  >
                    <span>{cat}</span>
                    <span className="text-slate-400">{isCollapsed ? "▸" : "▾"}</span>
                  </button>

                  {!isCollapsed && (
                    <div role="listbox" aria-label={`${cat} tools`} className="mt-1 flex flex-col gap-1">
                      {tools.map((t) => (
                        <ToolRow
                          key={t.id}
                          id={t.id}
                          name={t.name}
                          category={t.category}
                          active={t.id === activeToolId}
                          pinned={pinned.includes(t.id)}
                          onPin={() => togglePin(t.id)}
                          onOpen={() => onOpenTool(t.id)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="border-t border-slate-200 p-4 text-xs text-slate-500">
        Tip: use hash links like <span className="font-mono">/#dev/json-formatter</span>
      </div>
    </aside>
  );

  return (
    <>
      <div className="mb-4 flex items-center justify-between md:hidden">
        <div className="text-sm font-semibold text-slate-900">Text Toolkit</div>
        <IconButton aria-label="Open menu" onClick={() => onMobileOpenChange(true)} title="Menu">
          ☰
        </IconButton>
      </div>

      <div className="hidden md:block">
        <div className="sticky top-6 h-[calc(100dvh-48px)]">{Drawer}</div>
      </div>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true">
          <button className="absolute inset-0 bg-slate-900/30" aria-label="Close overlay" onClick={() => onMobileOpenChange(false)} />
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
  onOpen
}: {
  id: string;
  name: string;
  category: string;
  active: boolean;
  pinned: boolean;
  onPin: () => void;
  onOpen: () => void;
}) {
  return (
    <div
      id={id}
      role="option"
      aria-selected={active}
      className={[
        "group flex items-center justify-between gap-3 rounded-xl border px-3 py-2",
        active ? "border-blue-500 bg-blue-50" : "border-transparent hover:border-slate-200 hover:bg-slate-50"
      ].join(" ")}
    >
      <button onClick={onOpen} className="min-w-0 flex-1 text-left" aria-label={`Open ${name}`}>
        <div className="truncate text-sm font-medium text-slate-900">{name}</div>
        <div className="truncate text-xs text-slate-500">{category}</div>
      </button>

      <button
        type="button"
        className={[
          "rounded-lg px-2 py-1 text-xs font-medium",
          pinned ? "text-blue-700" : "text-slate-500",
          "hover:bg-white hover:shadow-sm"
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
