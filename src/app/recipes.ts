import { storage } from "../lib/storage";
import { toolStateKey } from "../lib/useToolState";
import { emitToolStateSync } from "../lib/usePersistedState";

export type ToolRecipe = {
  id: string;
  name: string;
  toolId: string;
  savedAt: number;
  state: Record<string, unknown>;
};

const LS_RECIPES = "tt:recipes";

function defaultPresetKey(toolId: string) {
  return `tt:defaultPreset:${toolId}`;
}

function safeId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function loadRecipes(): ToolRecipe[] {
  return storage.getJSON<ToolRecipe[]>(LS_RECIPES) ?? [];
}

export function saveRecipes(recipes: ToolRecipe[]) {
  storage.setJSON(LS_RECIPES, recipes);
}

export function listRecipesForTool(toolId: string): ToolRecipe[] {
  return loadRecipes().filter((r) => r.toolId === toolId);
}

export function createRecipeFromCurrentToolState(toolId: string, name: string): ToolRecipe | null {
  const state = storage.getJSON<Record<string, unknown>>(toolStateKey(toolId));
  if (!state) return null;

  const recipe: ToolRecipe = {
    id: safeId(),
    name: name.trim() || "Untitled preset",
    toolId,
    savedAt: Date.now(),
    state,
  };

  const all = loadRecipes();
  saveRecipes([recipe, ...all]);
  return recipe;
}

export function applyRecipeToTool(toolId: string, recipe: ToolRecipe) {
  if (recipe.toolId !== toolId) return;

  const k = toolStateKey(toolId);
  storage.setJSON(k, recipe.state);
  emitToolStateSync(k); // ✅ update toggles instantly
}

export function deleteRecipe(recipeId: string) {
  const all = loadRecipes();
  const deleted = all.find((r) => r.id === recipeId);

  // If the deleted recipe is default, clear default
  if (deleted) {
    const key = defaultPresetKey(deleted.toolId);
    const cur = storage.getJSON<string>(key) ?? "";
    if (cur === recipeId) storage.setJSON(key, "");
  }

  saveRecipes(all.filter((r) => r.id !== recipeId));
}

/** Default preset helpers */
export function setDefaultPreset(toolId: string, recipeId: string) {
  storage.setJSON(defaultPresetKey(toolId), recipeId);
}

export function clearDefaultPreset(toolId: string) {
  storage.setJSON(defaultPresetKey(toolId), "");
}

export function getDefaultPresetId(toolId: string): string {
  return storage.getJSON<string>(defaultPresetKey(toolId)) ?? "";
}

export function getDefaultPreset(toolId: string): ToolRecipe | null {
  const id = getDefaultPresetId(toolId);
  if (!id) return null;
  return loadRecipes().find((r) => r.toolId === toolId && r.id === id) ?? null;
}