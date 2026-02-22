import { useMemo, useState } from "react";
import { Button } from "../../components/ui/Button";
import { Textarea } from "../../components/ui/Textarea";
import { Toggle } from "../../components/ui/Toggle";
import { storage } from "../../lib/storage";
import { useDebouncedValue } from "../../lib/useDebouncedValue";

import type { SavedWorkflow, TransformId, WorkflowStep } from "../../core/transforms/types";
import { TRANSFORMS, TRANSFORM_LIST, defaultOptionsFor } from "../../core/transforms/registry";

const LS_WORKFLOWS = "tt:workflows";

function safeId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function loadWorkflows(): SavedWorkflow[] {
  return storage.getJSON<SavedWorkflow[]>(LS_WORKFLOWS) ?? [];
}

function saveWorkflows(items: SavedWorkflow[]) {
  storage.setJSON(LS_WORKFLOWS, items);
}

const SAMPLE = `[00:01] SPEAKER 1 - Um, hello everyone.
(00:05) John Doe — like, I mean we should start now.
00:12 Jane: Uh, yeah, basically the agenda is...
00:20 - SPEAKER 1: You know, let's do it.

[00:33] John Doe: Great!`;

export function WorkflowBuilderTool() {
  const [input, setInput] = useState<string>(SAMPLE);
  const debouncedInput = useDebouncedValue(input, 150);

  const [steps, setSteps] = useState<WorkflowStep[]>([
    { transformId: "transcript/clean", options: defaultOptionsFor("transcript/clean") },
    { transformId: "whitespace/normalize", options: defaultOptionsFor("whitespace/normalize") },
  ]);

  const [workflowName, setWorkflowName] = useState<string>("My workflow");
  const [saved, setSaved] = useState<SavedWorkflow[]>(() => loadWorkflows());
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string>("");

  const selectedWorkflow = useMemo(
    () => saved.find((w) => w.id === selectedWorkflowId) ?? null,
    [saved, selectedWorkflowId]
  );

  const output = useMemo(() => {
    let out = debouncedInput ?? "";
    for (const step of steps) {
      const t = TRANSFORMS[step.transformId];
      out = t.apply(out, step.options as any);
    }
    return out;
  }, [debouncedInput, steps]);

  function addStep(transformId: TransformId) {
    setSteps((prev) => [...prev, { transformId, options: defaultOptionsFor(transformId) }]);
  }

  function removeStep(index: number) {
    setSteps((prev) => prev.filter((_, i) => i !== index));
  }

  function moveStep(index: number, dir: -1 | 1) {
    setSteps((prev) => {
      const next = [...prev];
      const to = index + dir;
      if (to < 0 || to >= next.length) return prev;
      const tmp = next[index];
      next[index] = next[to];
      next[to] = tmp;
      return next;
    });
  }

  function updateStepOption(index: number, key: string, value: any) {
    setSteps((prev) => {
      const next = [...prev];
      const s = next[index];
      next[index] = { ...s, options: { ...s.options, [key]: value } };
      return next;
    });
  }

  function resetStepOptions(index: number) {
    setSteps((prev) => {
      const next = [...prev];
      const s = next[index];
      next[index] = { ...s, options: defaultOptionsFor(s.transformId) };
      return next;
    });
  }

  function saveWorkflow() {
    const now = Date.now();
    const w: SavedWorkflow = {
      id: safeId(),
      name: workflowName.trim() || "Untitled workflow",
      createdAt: now,
      updatedAt: now,
      steps,
    };
    const next = [w, ...loadWorkflows()];
    saveWorkflows(next);
    setSaved(next);
    setSelectedWorkflowId(w.id);
  }

  function loadWorkflow() {
    if (!selectedWorkflow) return;
    setWorkflowName(selectedWorkflow.name);
    setSteps(selectedWorkflow.steps);
  }

  function deleteWorkflow() {
    if (!selectedWorkflow) return;
    const ok = confirm(`Delete workflow "${selectedWorkflow.name}"?`);
    if (!ok) return;
    const next = loadWorkflows().filter((w) => w.id !== selectedWorkflow.id);
    saveWorkflows(next);
    setSaved(next);
    setSelectedWorkflowId("");
  }

  function resetAll() {
    setInput(SAMPLE);
    setWorkflowName("My workflow");
    setSteps([
      { transformId: "transcript/clean", options: defaultOptionsFor("transcript/clean") },
      { transformId: "whitespace/normalize", options: defaultOptionsFor("whitespace/normalize") },
    ]);
  }

  return (
    <div className="grid gap-6">
      {/* Top bar: Save/Load workflows */}
      <div className="grid gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <div className="text-sm font-semibold text-slate-900">Workflow</div>

        <div className="flex flex-wrap gap-2 items-center">
          <input
            className="h-9 rounded-md border border-slate-200 px-3 text-sm bg-white"
            value={workflowName}
            onChange={(e) => setWorkflowName(e.target.value)}
            placeholder="Workflow name"
          />

          <Button type="button" onClick={saveWorkflow}>
            Save workflow
          </Button>

          <select
            className="h-9 rounded-md border border-slate-200 px-2 text-sm bg-white min-w-[220px]"
            value={selectedWorkflowId}
            onChange={(e) => setSelectedWorkflowId(e.target.value)}
            aria-label="Select workflow"
          >
            <option value="">Load a saved workflow…</option>
            {saved.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>

          <Button type="button" onClick={loadWorkflow} disabled={!selectedWorkflow}>
            Load
          </Button>

          <Button type="button" onClick={deleteWorkflow} disabled={!selectedWorkflow}>
            Delete
          </Button>

          <Button type="button" onClick={resetAll}>
            Reset
          </Button>

          <div className="text-xs opacity-70">Saved locally in your browser.</div>
        </div>
      </div>

      {/* Input */}
      <div className="grid gap-3">
        <div className="text-sm font-semibold text-slate-900">Input</div>
        <Textarea value={input} onChange={(e) => setInput(e.target.value)} rows={10} spellCheck={false} />
      </div>

      {/* Steps */}
      <div className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm font-semibold text-slate-900">Steps</div>

          <div className="flex items-center gap-2">
            <select
              className="h-9 rounded-md border border-slate-200 px-2 text-sm bg-white"
              defaultValue=""
              onChange={(e) => {
                const v = e.target.value as TransformId;
                if (!v) return;
                addStep(v);
                e.currentTarget.value = "";
              }}
              aria-label="Add step"
            >
              <option value="">Add step…</option>
              {TRANSFORM_LIST.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {steps.length === 0 ? (
          <div className="text-sm opacity-70">Add a step to start building a workflow.</div>
        ) : (
          <div className="grid gap-3">
            {steps.map((step, idx) => {
              const t = TRANSFORMS[step.transformId];

              return (
                <div key={`${step.transformId}:${idx}`} className="rounded-xl border border-slate-200 bg-white p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-slate-900">
                        {idx + 1}. {t.name}
                      </div>
                      <div className="mt-1 text-xs text-slate-500">{t.description}</div>
                    </div>

                    <div className="flex gap-2">
                      <button className="px-2 py-1 rounded-md border text-xs" onClick={() => moveStep(idx, -1)} disabled={idx === 0}>
                        ↑
                      </button>
                      <button
                        className="px-2 py-1 rounded-md border text-xs"
                        onClick={() => moveStep(idx, 1)}
                        disabled={idx === steps.length - 1}
                      >
                        ↓
                      </button>
                      <button className="px-2 py-1 rounded-md border text-xs" onClick={() => resetStepOptions(idx)}>
                        Reset
                      </button>
                      <button className="px-2 py-1 rounded-md border text-xs" onClick={() => removeStep(idx)}>
                        Remove
                      </button>
                    </div>
                  </div>

                  {/* Simplified options renderer */}
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {t.schema.fields.map((f) => {
                      const val = step.options[f.key];

                      if (f.type === "boolean") {
                        return (
                          <div key={f.key} className="rounded-lg border border-slate-200 p-2">
                            <Toggle
                              checked={Boolean(val)}
                              onChange={(v) => updateStepOption(idx, f.key, v)}
                              label={f.label}
                            />
                          </div>
                        );
                      }

                      if (f.type === "number") {
                        return (
                          <label key={f.key} className="rounded-lg border border-slate-200 p-2 grid gap-1 text-sm text-slate-800">
                            <span className="text-xs font-medium text-slate-700">{f.label}</span>
                            <input
                              className="h-9 rounded-md border border-slate-200 px-3 text-sm"
                              type="number"
                              min={f.min}
                              max={f.max}
                              step={f.step ?? 1}
                              value={Number(val)}
                              onChange={(e) => updateStepOption(idx, f.key, Number(e.target.value))}
                            />
                          </label>
                        );
                      }

                      // select
                      return (
                        <label key={f.key} className="rounded-lg border border-slate-200 p-2 grid gap-1 text-sm text-slate-800">
                          <span className="text-xs font-medium text-slate-700">{f.label}</span>
                          <select
                            className="h-9 rounded-md border border-slate-200 px-2 text-sm bg-white"
                            value={String(val)}
                            onChange={(e) => updateStepOption(idx, f.key, e.target.value)}
                          >
                            {f.options.map((o) => (
                              <option key={o.value} value={o.value}>
                                {o.label}
                              </option>
                            ))}
                          </select>
                        </label>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Output */}
      <div className="grid gap-2">
        <div className="text-sm font-semibold text-slate-900">Output</div>
        <Textarea value={output} readOnly rows={12} />
        <div className="text-xs text-slate-500">Output is computed locally from input + steps.</div>
      </div>
    </div>
  );
}