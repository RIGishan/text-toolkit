import { useEffect, useRef, useState } from "react";
import { storage } from "./storage";

type ToolStateSyncEventDetail = { key: string };

const TOOLSTATE_EVENT = "tt:toolstate-sync";

export function emitToolStateSync(key: string) {
  window.dispatchEvent(
    new CustomEvent<ToolStateSyncEventDetail>(TOOLSTATE_EVENT, { detail: { key } })
  );
}

export function usePersistedState<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => storage.getJSON<T>(key) ?? initial);

  // prevents infinite loops when we update state due to sync
  const applyingSync = useRef(false);

  useEffect(() => {
    storage.setJSON(key, value);

    // ✅ when local user changes happen, notify same-tab listeners (ToolShell)
    if (!applyingSync.current) {
      emitToolStateSync(key);
    } else {
      applyingSync.current = false;
    }
  }, [key, value]);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== key) return;
      applyingSync.current = true;
      setValue(storage.getJSON<T>(key) ?? initial);
    };

    const onSync = (e: Event) => {
      const ce = e as CustomEvent<ToolStateSyncEventDetail>;
      if (ce.detail?.key !== key) return;
      applyingSync.current = true;
      setValue(storage.getJSON<T>(key) ?? initial);
    };

    window.addEventListener("storage", onStorage);
    window.addEventListener(TOOLSTATE_EVENT, onSync);

    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(TOOLSTATE_EVENT, onSync);
    };
  }, [key, initial]);

  return [value, setValue] as const;
}