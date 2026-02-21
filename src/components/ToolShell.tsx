import type { ReactNode } from "react";

export function ToolShell({
  title,
  description,
  toolId,
  children
}: {
  title: string;
  description: string;
  toolId: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-soft" aria-label={title}>
      <header className="border-b border-slate-200 px-6 py-5">
        <div className="flex flex-col gap-1">
          <h1 className="text-lg font-semibold tracking-tight text-slate-900">{title}</h1>
          <p className="text-sm text-slate-600">{description}</p>
          <p className="text-xs text-slate-500">
            Runs locally in your browser (no uploads) • <span className="font-mono">{toolId}</span>
          </p>
        </div>
      </header>

      <div className="p-6">{children}</div>
    </section>
  );
}
