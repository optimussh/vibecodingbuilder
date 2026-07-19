/**
 * Normalize OpenCode / platform session-diff payloads into file rows.
 * Shared pure helper (mirrored by web DiffViewer structured UI).
 */
export type FileDiffEntry = {
  path: string;
  status?: string;
  additions?: number;
  deletions?: number;
  before?: string;
  after?: string;
  patch?: string;
  raw?: unknown;
};

function pickString(
  obj: Record<string, unknown>,
  keys: string[],
): string | undefined {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === "string" && v.length > 0) return v;
  }
  return undefined;
}

function pickNumber(
  obj: Record<string, unknown>,
  keys: string[],
): number | undefined {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === "number" && Number.isFinite(v)) return v;
  }
  return undefined;
}

export function parseSessionDiff(raw: unknown): FileDiffEntry[] | null {
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
          path:
            pickString(o, ["path", "file", "filename", "filePath"]) ||
            "(session)",
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
