import { useMemo, useState } from "react";
import { Sidebar } from "../components/Sidebar";
import { ToolShell } from "../components/ToolShell";
import { getToolById } from "./toolsRegistry";
import { useHashRouter } from "./hashRouter";

export default function App() {
  const { activeToolId, openTool } = useHashRouter();
  const tool = useMemo(() => getToolById(activeToolId), [activeToolId]);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-dvh bg-slate-50">
      <div className="mx-auto max-w-[1280px] px-4 py-4 md:px-6 md:py-6">
        <div className="grid gap-4 md:grid-cols-[320px_1fr] md:gap-6">
          <Sidebar
            activeToolId={activeToolId}
            onOpenTool={(id) => {
              openTool(id);
              setMobileOpen(false);
            }}
            mobileOpen={mobileOpen}
            onMobileOpenChange={setMobileOpen}
          />

          <main className="min-w-0">
            {tool ? (
              <ToolShell title={tool.name} description={tool.description} toolId={tool.id}>
                <tool.Component />
              </ToolShell>
            ) : (
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-soft">
                <p className="text-sm text-slate-700">
                  Tool not found. Check the URL hash and try again.
                </p>
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
