import { useCallback, useEffect, useState } from "react";
import { api } from "../api/client";
import { useChatStore } from "../stores/chatStore";

type Spec = {
  id: string;
  title: string;
  requirements: string;
  design: string;
  tasks: Array<{ id: string; title: string; done: boolean }>;
};

export function SpecPanel() {
  const projectId = useChatStore((s) => s.projectId);
  const [specs, setSpecs] = useState<Spec[]>([]);
  const [active, setActive] = useState<Spec | null>(null);
  const [title, setTitle] = useState("New spec");

  const refresh = useCallback(async () => {
    const r = await api.specs();
    setSpecs(r.specs as Spec[]);
  }, []);

  useEffect(() => {
    void refresh().catch(() => setSpecs([]));
  }, [refresh]);

  if (active) {
    return (
      <div className="flex h-full flex-col gap-2 overflow-auto p-2 text-xs text-zinc-300">
        <button
          type="button"
          className="text-left text-indigo-400"
          onClick={() => setActive(null)}
        >
          ← Specs
        </button>
        <input
          className="rounded border border-zinc-700 bg-zinc-950 px-2 py-1 font-semibold"
          value={active.title}
          onChange={(e) => setActive({ ...active, title: e.target.value })}
        />
        <label className="text-[10px] text-zinc-500">Requirements</label>
        <textarea
          className="min-h-20 rounded border border-zinc-700 bg-zinc-950 p-2"
          value={active.requirements}
          onChange={(e) =>
            setActive({ ...active, requirements: e.target.value })
          }
        />
        <label className="text-[10px] text-zinc-500">Design</label>
        <textarea
          className="min-h-20 rounded border border-zinc-700 bg-zinc-950 p-2"
          value={active.design}
          onChange={(e) => setActive({ ...active, design: e.target.value })}
        />
        <label className="text-[10px] text-zinc-500">Tasks</label>
        <ul className="space-y-1">
          {(active.tasks ?? []).map((t, i) => (
            <li key={t.id} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={t.done}
                onChange={() => {
                  const tasks = [...active.tasks];
                  tasks[i] = { ...t, done: !t.done };
                  setActive({ ...active, tasks });
                }}
              />
              <span className={t.done ? "line-through text-zinc-500" : ""}>
                {t.title}
              </span>
            </li>
          ))}
        </ul>
        <button
          type="button"
          className="rounded bg-indigo-600 px-2 py-1 text-white"
          onClick={() => {
            void api
              .patchSpec(active.id, {
                title: active.title,
                requirements: active.requirements,
                design: active.design,
                tasks: active.tasks,
              })
              .then(() => refresh());
          }}
        >
          Save
        </button>
        <button
          type="button"
          className="rounded border border-zinc-600 px-2 py-1"
          onClick={() => {
            const id = `t_${Date.now()}`;
            setActive({
              ...active,
              tasks: [
                ...(active.tasks ?? []),
                { id, title: "New task", done: false },
              ],
            });
          }}
        >
          + Task
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-2 overflow-auto p-2 text-xs text-zinc-300">
      <div className="font-semibold text-zinc-100">Spec-lite</div>
      <div className="flex gap-1">
        <input
          className="min-w-0 flex-1 rounded border border-zinc-700 bg-zinc-950 px-2 py-1"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <button
          type="button"
          className="rounded bg-indigo-600 px-2 py-1 text-white"
          onClick={() => {
            void api.createSpec(title, projectId).then((s) => {
              void refresh();
              setActive(s as unknown as Spec);
            });
          }}
        >
          +
        </button>
      </div>
      <ul className="space-y-1">
        {specs.map((s) => (
          <li key={s.id}>
            <button
              type="button"
              className="w-full rounded border border-zinc-800 px-2 py-1 text-left hover:border-indigo-500"
              onClick={() => setActive(s)}
            >
              {s.title}
              <span className="ml-1 text-[10px] text-zinc-500">
                {(s.tasks ?? []).filter((t) => t.done).length}/
                {(s.tasks ?? []).length}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
