import { useCallback, useEffect, useState } from "react";
import { api } from "../api/client";

export function GitPanel() {
  const [status, setStatus] = useState<string>("…");
  const [diff, setDiff] = useState("");
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const s = await api.gitStatus();
      if (!s.isRepo) {
        setStatus("not a repo");
        setDiff("");
        return;
      }
      setStatus(
        `branch ${s.branch ?? "?"} · M:${s.modified?.length ?? 0} S:${s.staged?.length ?? 0} ?:${s.not_added?.length ?? 0}`,
      );
      const d = await api.gitDiff();
      setDiff(d.diff || "(clean)");
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "git error");
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <div className="flex max-h-48 flex-col border-t border-zinc-800 bg-zinc-950/80">
      <div className="flex items-center justify-between px-3 py-1.5 text-[11px]">
        <span className="text-zinc-400">Git · {status}</span>
        <div className="flex gap-2">
          <button
            type="button"
            className="text-indigo-400 hover:text-indigo-300"
            disabled={busy}
            onClick={() => void refresh()}
          >
            Refresh
          </button>
          <button
            type="button"
            className="text-emerald-400 hover:text-emerald-300"
            disabled={busy}
            onClick={() => {
              setBusy(true);
              void api
                .gitInit()
                .then(() => refresh())
                .finally(() => setBusy(false));
            }}
          >
            Init
          </button>
        </div>
      </div>
      <pre className="max-h-32 overflow-auto px-3 pb-2 font-mono text-[10px] text-zinc-500 whitespace-pre-wrap">
        {diff.slice(0, 4000)}
        {diff.length > 4000 ? "\n…" : ""}
      </pre>
    </div>
  );
}
