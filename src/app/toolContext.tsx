import { createContext, useContext, type ReactNode } from "react";

type ToolContextValue = {
  toolId: string;
};

const ToolContext = createContext<ToolContextValue | null>(null);

export function ToolProvider({
  toolId,
  children,
}: {
  toolId: string;
  children: ReactNode;
}) {
  return (
    <ToolContext.Provider value={{ toolId }}>
      {children}
    </ToolContext.Provider>
  );
}

export function useToolContext(): ToolContextValue {
  const ctx = useContext(ToolContext);
  if (!ctx) throw new Error("useToolContext must be used within ToolProvider");
  return ctx;
}