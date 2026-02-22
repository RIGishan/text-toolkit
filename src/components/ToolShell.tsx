import type { ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { ToolProvider } from "../app/toolContext";
import {
  applyRecipeToTool,
  createRecipeFromCurrentToolState,
  deleteRecipe,
  listRecipesForTool,
  type ToolRecipe,
  getDefaultPresetId,
  getDefaultPreset,
  setDefaultPreset,
  clearDefaultPreset,
} from "../app/recipes";
import { storage } from "../lib/storage";
import { toolStateKey } from "../lib/useToolState";
import { emitToolStateSync } from "../lib/usePersistedState";

/** Stable stringify so object key order doesn't cause false "modified" detection. */
function stableStringify(value: unknown): string {
  const seen = new WeakSet<object>();

  const normalize = (v: any): any => {
    if (v === null || typeof v !== "object") return v;
    if (v instanceof Date) return v.toISOString();
    if (Array.isArray(v)) return v.map(normalize);

    if (seen.has(v)) return "[Circular]";
    seen.add(v);

    const keys = Object.keys(v).sort();
    const out: Record<string, any> = {};
    for (const k of keys) out[k] = normalize(v[k]);
    return out;
  };

  return JSON.stringify(normalize(value));
}

export function ToolShell({
  title,
  description,
  toolId,
  children,
}: {
  title: string;
  description: string;
  toolId: string;
  children: ReactNode;
}) {
  const [recipes, setRecipes] = useState<ToolRecipe[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");

  const selected = useMemo(
    () => recipes.find((r) => r.id === selectedId) ?? null,
    [recipes, selectedId]
  );

  // UI state
  const [activePresetName, setActivePresetName] = useState<string>("");
  const [isModified, setIsModified] = useState<boolean>(false);
  const [defaultId, setDefaultId] = useState<string>("");

  // ✅ refs (always latest inside event handlers)
  const activePresetIdRef = useRef<string>("");
  const activePresetNameRef = useRef<string>("");
  const baselineJsonRef = useRef<string>("");
  const baselineStateRef = useRef<Record<string, unknown> | null>(null);

  function reloadPresetsList() {
    setRecipes(listRecipesForTool(toolId));
    setDefaultId(getDefaultPresetId(toolId));
  }

  function captureBaselineFromRecipe(recipe: ToolRecipe) {
    activePresetIdRef.current = recipe.id;
    activePresetNameRef.current = recipe.name;
    baselineStateRef.current = recipe.state;
    baselineJsonRef.current = stableStringify(recipe.state);

    setActivePresetName(recipe.name);
    setIsModified(false);
  }

  function checkIfModified() {
    const baseline = baselineJsonRef.current;
    if (!baseline) return;

    const cur = storage.getJSON<Record<string, unknown>>(toolStateKey(toolId)) ?? {};
    const curJson = stableStringify(cur);

    const modified = curJson !== baseline;
    setIsModified(modified);
  }

  // Tool change: load presets, auto-apply default, attach listeners ONCE per toolId
  useEffect(() => {
    reloadPresetsList();
    setSelectedId("");

    // reset refs + UI
    activePresetIdRef.current = "";
    activePresetNameRef.current = "";
    baselineJsonRef.current = "";
    baselineStateRef.current = null;

    setActivePresetName("");
    setIsModified(false);

    // Auto apply default preset if any
    const def = getDefaultPreset(toolId);
    if (def) {
      applyRecipeToTool(toolId, def);
      setSelectedId(def.id);
      captureBaselineFromRecipe(def);
    }

    const key = toolStateKey(toolId);

    const onSync = (e: Event) => {
      const ce = e as CustomEvent<{ key: string }>;
      if (ce.detail?.key !== key) return;
      checkIfModified();
    };

    const onStorage = (e: StorageEvent) => {
      if (e.key !== key) return;
      checkIfModified();
    };

    window.addEventListener("tt:toolstate-sync", onSync as EventListener);
    window.addEventListener("storage", onStorage);

    return () => {
      window.removeEventListener("tt:toolstate-sync", onSync as EventListener);
      window.removeEventListener("storage", onStorage);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toolId]);

  function savePreset() {
    const existingState = storage.getJSON<Record<string, unknown>>(toolStateKey(toolId));
    if (!existingState) {
      alert("This tool doesn’t have persisted settings yet. Refactor it to use useToolState() first.");
      return;
    }

    const name = prompt("Preset name?");
    if (!name) return;

    const created = createRecipeFromCurrentToolState(toolId, name);
    if (!created) return;

    reloadPresetsList();
    setSelectedId(created.id);
    captureBaselineFromRecipe(created);
  }

  function loadPreset() {
    if (!selected) return;

    applyRecipeToTool(toolId, selected);
    captureBaselineFromRecipe(selected);
  }

  function revertToActivePreset() {
    const presetId = activePresetIdRef.current;
    const baselineState = baselineStateRef.current;

    if (!presetId || !baselineState) return;

    const k = toolStateKey(toolId);
    storage.setJSON(k, baselineState);
    emitToolStateSync(k);

    setIsModified(false);
    setActivePresetName(activePresetNameRef.current);
  }

  function removePreset() {
    if (!selected) return;
    const ok = confirm(`Delete preset "${selected.name}"?`);
    if (!ok) return;

    deleteRecipe(selected.id);

    // If deleting active preset -> clear everything
    if (activePresetIdRef.current === selected.id) {
      activePresetIdRef.current = "";
      activePresetNameRef.current = "";
      baselineJsonRef.current = "";
      baselineStateRef.current = null;

      setActivePresetName("");
      setIsModified(false);
    }

    reloadPresetsList();
    setSelectedId("");
  }

  function toggleDefaultPreset() {
    if (!selected) return;

    if (selected.id === defaultId) {
      clearDefaultPreset(toolId);
      setDefaultId("");
    } else {
      setDefaultPreset(toolId, selected.id);
      setDefaultId(selected.id);
    }
  }

  const btnBase =
    "px-2.5 py-1 rounded-md border text-xs font-medium leading-5 transition " +
    "disabled:opacity-50 disabled:cursor-not-allowed";

  const isSelectedDefault = selectedId && selectedId === defaultId;
  const showActiveBadge = !!activePresetName;
  const activeLabel = isModified ? "Custom (modified)" : activePresetName;

  return (
    <ToolProvider toolId={toolId}>
      <div className="p-4 md:p-6 max-w-4xl">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold">{title}</h1>
          <p className="mt-1 text-sm opacity-80">{description}</p>
          <div className="mt-2 text-xs opacity-70">
            Runs locally in your browser (no uploads) • <span className="font-mono">{toolId}</span>
          </div>

          <div className="mt-3 relative flex flex-wrap items-center gap-2">
            {showActiveBadge && (
              <div
                className="absolute text-[11px] px-2 py-[2px] rounded-md"
                style={{
                  background: "#EFF6FF",
                  color: "#1D4ED8",
                  border: "1px solid #BFDBFE",
                  top: "100%",
                  left: "93px",
                  marginTop: "6px",
                }}
              >
                Active preset: <span className="font-semibold">{activeLabel}</span>
              </div>
            )}

            <button
              className={btnBase}
              style={{ background: "#EFF6FF", borderColor: "#BFDBFE" }}
              onClick={savePreset}
              title="Save current settings as a preset"
            >
              Save preset
            </button>

            <select
              className="px-2 py-1 rounded-md border text-xs min-w-[220px]"
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
              aria-label="Select preset"
            >
              <option value="">Load a preset…</option>
              {recipes.map((r) => {
                const isDefault = r.id === defaultId;
                return (
                  <option key={r.id} value={r.id}>
                    {r.name}
                    {isDefault ? " (default)" : ""}
                  </option>
                );
              })}
            </select>

            <button
              className={btnBase}
              style={{ background: "#ECFDF5", borderColor: "#A7F3D0" }}
              onClick={loadPreset}
              disabled={!selected}
              title="Apply selected preset"
            >
              Load
            </button>

            <button
              className={btnBase}
              style={{ background: "#F5F3FF", borderColor: "#DDD6FE" }}
              onClick={revertToActivePreset}
              disabled={!isModified || !baselineStateRef.current}
              title="Revert options back to the active preset"
            >
              Revert
            </button>

            <button
              className={btnBase}
              style={{ background: "#FFFBEB", borderColor: "#FDE68A" }}
              onClick={toggleDefaultPreset}
              disabled={!selected}
              title={isSelectedDefault ? "Unset default preset" : "Set selected preset as default"}
            >
              {isSelectedDefault ? "★ Default" : "☆ Set default"}
            </button>

            <button
              className={btnBase}
              style={{ background: "#FEF2F2", borderColor: "#FECACA" }}
              onClick={removePreset}
              disabled={!selected}
              title="Delete selected preset"
            >
              Delete
            </button>

            <div className="text-xs opacity-70">Tip: Presets are stored locally in your browser.</div>
          </div>
        </div>

        {children}
      </div>
    </ToolProvider>
  );
}