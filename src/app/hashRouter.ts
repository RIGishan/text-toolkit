import { useEffect, useMemo, useState } from "react";
import { getToolById, toolsRegistry } from "./toolsRegistry";
import { storage } from "../lib/storage";

const LS_LAST_TOOL = "tt:lastToolId";

function normalizeHashToToolId(hash: string): string | null {
  const raw = hash.replace(/^#\/?/, "").trim();
  if (!raw) return null;
  return raw;
}

export function setHashTool(toolId: string) {
  window.location.hash = `#${toolId}`;
}

export function useHashRouter() {
  const [hash, setHash] = useState<string>(() => window.location.hash || "");

  useEffect(() => {
    const onChange = () => setHash(window.location.hash || "");
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);

  const activeToolId = useMemo(() => {
    const fromHash = normalizeHashToToolId(hash);
    if (fromHash && getToolById(fromHash)) return fromHash;

    const fromStorage = storage.getString(LS_LAST_TOOL);
    if (fromStorage && getToolById(fromStorage)) return fromStorage;

    return toolsRegistry[0]?.id ?? "";
  }, [hash]);

  useEffect(() => {
    if (activeToolId) storage.setString(LS_LAST_TOOL, activeToolId);
  }, [activeToolId]);

  function openTool(toolId: string) {
    if (!getToolById(toolId)) return;
    setHashTool(toolId);
  }

  return { activeToolId, openTool };
}
