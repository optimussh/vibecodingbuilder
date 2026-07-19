import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { api } from "../api/client";
import { useChatStore } from "../stores/chatStore";

function colorizeDiff(diff: string): ReactNode[] {
  return diff.split("\n").map((line, i) => {
    let cls = "text-zinc-400";
    if (line.startsWith("+") && !line.startsWith("+++")) cls = "text-emerald-400";
    else if (line.startsWith("-") && !line.startsWith("---")) cls = "text-red-400";
    else if (line.startsWith("@@")) cls = "text-cyan-400";
    else if (line.startsWith("diff ") || line.startsWith("index "))
      cls = "text-zinc-500";
    return (
      <div key={i} className={cls}>
        {line || " "}
      </div>
    );
  });
}

type FileDiffEntry = {
  path: string;
  status?: string;
  additions?: number;
  deletions?: number;
  before?: string;
  after?: string;
  patch?: string;
  raw?: unknown;
};

function pickString(obj: Record<string, unknown>, keys: string[]): string | undefined {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === "string" && v.length > 0) return v;
  }
  return undefined;
}

function pickNumber(obj: Record<string, unknown>, keys: string[]): number | undefined {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === "number" && Number.isFinite(v)) return v;
  }
  return undefined;
}

/** Normalize OpenCode / platform session-diff payloads into file rows. */
export function parseSessionDiff(raw: unknown): FileDiffEntry[] | null {
  // Keep in sync with apps/server/src/sessionDiffParse.ts
  if (raw == null) return null;

  let list: unknown[] | null = null;
  if (Array.isArray(raw)) {
    list = raw;
  } else if (typeof raw === "object") {
    const o = raw as Record<string, unknown>;
    if (Array.isArray(o.files)) list = o.files;
    else if (Array.isArray(o.diff)) list = o.diff;
    else if (Array.isArray(o.patches)) list = o.patches;
    else if (Array.isArray(o.entries)) list = o.entries;
    else if (typeof o.patch === "string" || typeof o.diff === "string") {
      return [
        {
          path: pickString(o, ["path", "file", "filename", "filePath"]) || "(session)",
          patch: (o.patch as string) || (o.diff as string),
          raw: o,
        },
      ];
    }
  } else if (typeof raw === "string") {
    try {
      return parseSessionDiff(JSON.parse(raw));
    } catch {
      return null;
    }
  }

  if (!list || list.length === 0) return null;

  const entries: FileDiffEntry[] = [];
  for (const item of list) {
    if (typeof item === "string") {
      entries.push({ path: item });
      continue;
    }
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const path =
      pickString(o, [
        "path",
        "file",
        "filename",
        "filePath",
        "name",
        "file_path",
      ]) || "(unknown)";
    entries.push({
      path,
      status: pickString(o, ["status", "type", "kind", "change"]),
      additions: pickNumber(o, ["additions", "added", "insertions", "+"]),
      deletions: pickNumber(o, ["deletions", "deleted", "removals", "-"]),
      before: pickString(o, ["before", "old", "previous", "left"]),
      after: pickString(o, ["after", "new", "next", "right"]),
      patch: pickString(o, ["patch", "diff", "unified", "content"]),
      raw: item,
    });
  }
  return entries.length ? entries : null;
}

function FileDiffStructure({ entries }: { entries: FileDiffEntry[] }) {
  const [openPath, setOpenPath] = useState<string | null>(entries[0]?.path ?? null);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden sm:flex-row">
      <ul className="max-h-40 shrink-0 overflow-auto border-b border-zinc-800 sm:max-h-none sm:w-52 sm:border-b-0 sm:border-r">
        {entries.map((e) => {
          const active = openPath === e.path;
          return (
            <li key={e.path}>
              <button
                type="button"
                onClick={() => setOpenPath(e.path)}
                className={`flex w-full flex-col gap-0.5 px-3 py-2 text-left text-[11px] ${
                  active
                    ? "bg-indigo-950/60 text-indigo-200"
                    : "text-zinc-300 hover:bg-zinc-800/80"
                }`}
              >
                <span className="truncate font-medium" title={e.path}>
                  {e.path.split(/[/\\]/).pop() || e.path}
                </span>
                <span className="truncate text-[10px] text-zinc-500" title={e.path}>
                  {e.path}
                </span>
                <span className="flex gap-2 text-[10px]">
                  {e.status && (
                    <span className="text-zinc-400">{e.status}</span>
                  )}
                  {typeof e.additions === "number" && (
                    <span className="text-emerald-400">+{e.additions}</span>
                  )}
                  {typeof e.deletions === "number" && (
                    <span className="text-red-400">−{e.deletions}</span>
                  )}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <div className="min-h-0 flex-1 overflow-auto p-3 font-mono text-[11px] leading-relaxed">
        {(() => {
          const e = entries.find((x) => x.path === openPath) ?? entries[0];
          if (!e) return <span className="text-zinc-500">No files</span>;
          if (e.patch) {
            return <div>{colorizeDiff(e.patch)}</div>;
          }
          if (e.before != null || e.after != null) {
            return (
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <div className="mb-1 text-[10px] uppercase tracking-wide text-zinc-500">
                    Before
                  </div>
                  <pre className="whitespace-pre-wrap rounded border border-zinc-800 bg-zinc-950/60 p-2 text-red-300/90">
                    {e.before ?? "(empty)"}
                  </pre>
                </div>
                <div>
                  <div className="mb-1 text-[10px] uppercase tracking-wide text-zinc-500">
                    After
                  </div>
                  <pre className="whitespace-pre-wrap rounded border border-zinc-800 bg-zinc-950/60 p-2 text-emerald-300/90">
                    {e.after ?? "(empty)"}
                  </pre>
                </div>
              </div>
            );
          }
          return (
            <pre className="whitespace-pre-wrap text-zinc-400">
              {JSON.stringify(e.raw ?? e, null, 2)}
            </pre>
          );
        })()}
      </div>
    </div>
  );
}

export function DiffViewer() {
  const activeSessionId = useChatStore((s) => s.activeSessionId);
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"git" | "session">("git");
  const [text, setText] = useState("");
  const [sessionRaw, setSessionRaw] = useState<unknown>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const sessionEntries = useMemo(
    () => (tab === "session" ? parseSessionDiff(sessionRaw) : null),
    [tab, sessionRaw],
  );

  const load = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      if (tab === "git") {
        const d = await api.gitDiff(false);
        setText(d.diff || "(no unstaged changes)");
        setSessionRaw(null);
      } else if (activeSessionId) {
        const raw = await api.sessionDiff(activeSessionId);
        setSessionRaw(raw);
        setText(
          typeof raw === "string" ? raw : JSON.stringify(raw, null, 2),
        );
      } else {
        setText("(select a session)");
        setSessionRaw(null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "diff failed");
      setText("");
      setSessionRaw(null);
    } finally {
      setBusy(false);
    }
  }, [tab, activeSessionId]);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-14 right-4 z-40 rounded-full border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-200 shadow-lg hover:border-indigo-500"
      >
        Diff
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center">
      <div className="flex max-h-[80vh] w-full max-w-3xl flex-col rounded-xl border border-zinc-700 bg-zinc-900 shadow-2xl">
        <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-2">
          <div className="flex gap-2 text-xs">
            <button
              type="button"
              onClick={() => setTab("git")}
              className={`rounded px-2 py-1 ${tab === "git" ? "bg-indigo-600 text-white" : "text-zinc-400"}`}
            >
              Git working tree
            </button>
            <button
              type="button"
              onClick={() => setTab("session")}
              className={`rounded px-2 py-1 ${tab === "session" ? "bg-indigo-600 text-white" : "text-zinc-400"}`}
            >
              Session diff
            </button>
            <button
              type="button"
              onClick={() => void load()}
              disabled={busy}
              className="text-zinc-500 hover:text-zinc-300"
            >
              Refresh
            </button>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="text-zinc-400 hover:text-white"
          >
            Close
          </button>
        </div>
        {error && (
          <div className="border-b border-red-900 bg-red-950/40 px-4 py-2 text-xs text-red-300">
            {error}
          </div>
        )}
        {busy ? (
          <div className="p-4 text-xs text-zinc-500">Loading…</div>
        ) : tab === "session" && sessionEntries ? (
          <>
            <div className="border-b border-zinc-800 px-4 py-1.5 text-[10px] text-zinc-500">
              {sessionEntries.length} file
              {sessionEntries.length === 1 ? "" : "s"} · structured view
            </div>
            <FileDiffStructure entries={sessionEntries} />
          </>
        ) : (
          <pre className="flex-1 overflow-auto p-4 font-mono text-[11px] leading-relaxed">
            {colorizeDiff(text)}
          </pre>
        )}
      </div>
    </div>
  );
}
