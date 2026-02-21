export const storage = {
  getString(key: string): string | null {
    try {
      const v = localStorage.getItem(key);
      return typeof v === "string" ? v : null;
    } catch {
      return null;
    }
  },
  setString(key: string, value: string) {
    try {
      localStorage.setItem(key, value);
    } catch {
      // ignore
    }
  },
  getJSON<T>(key: string): T | null {
    try {
      const v = localStorage.getItem(key);
      if (!v) return null;
      return JSON.parse(v) as T;
    } catch {
      return null;
    }
  },
  setJSON(key: string, value: unknown) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // ignore
    }
  }
};
