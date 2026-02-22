import { usePersistedState } from "./usePersistedState";

export function toolStateKey(toolId: string) {
  return `tt:toolState:${toolId}`;
}

export function useToolState<T extends Record<string, unknown>>(toolId: string, initial: T) {
  return usePersistedState<T>(toolStateKey(toolId), initial);
}