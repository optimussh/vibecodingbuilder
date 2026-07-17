import fs from "node:fs";
import path from "node:path";
import { config } from "./config.js";
import { checkRagDb, withClient } from "./rag/db.js";

export interface SessionRecord {
  username: string;
  workspace: string;
  createdAt: string;
}

const ownership = new Map<string, SessionRecord>();
const mapFile = () =>
  path.resolve(config.projectRoot, "data/session-map.json");

function persistFile(): void {
  const dir = path.dirname(mapFile());
  fs.mkdirSync(dir, { recursive: true });
  const obj: Record<string, SessionRecord> = {};
  for (const [id, rec] of ownership) obj[id] = rec;
  fs.writeFileSync(mapFile(), JSON.stringify(obj, null, 2), "utf8");
}

async function persistPg(
  sessionId: string,
  rec: SessionRecord,
): Promise<void> {
  try {
    if ((await checkRagDb()) !== "up") return;
    await withClient(async (client) => {
      await client.query(
        `INSERT INTO agent_sessions (session_id, username, workspace, created_at)
         VALUES ($1, $2, $3, $4::timestamptz)
         ON CONFLICT (session_id) DO UPDATE
         SET username = EXCLUDED.username,
             workspace = EXCLUDED.workspace`,
        [sessionId, rec.username, rec.workspace, rec.createdAt],
      );
    });
  } catch (err) {
    console.warn("[sessionMap] pg persist failed:", err);
  }
}

async function deletePg(sessionId: string): Promise<void> {
  try {
    if ((await checkRagDb()) !== "up") return;
    await withClient(async (client) => {
      await client.query(`DELETE FROM agent_sessions WHERE session_id = $1`, [
        sessionId,
      ]);
    });
  } catch (err) {
    console.warn("[sessionMap] pg delete failed:", err);
  }
}

export function loadFromDisk(): void {
  ownership.clear();
  try {
    if (!fs.existsSync(mapFile())) return;
    const raw = JSON.parse(fs.readFileSync(mapFile(), "utf8")) as Record<
      string,
      SessionRecord | string
    >;
    for (const [id, v] of Object.entries(raw)) {
      if (typeof v === "string") {
        ownership.set(id, {
          username: v,
          workspace: path.join(config.workspacesRoot, v),
          createdAt: new Date(0).toISOString(),
        });
      } else if (v && typeof v === "object" && v.username) {
        ownership.set(id, v);
      }
    }
  } catch (err) {
    console.warn("[sessionMap] load failed:", err);
  }
}

/** Load from Postgres if available (merges over file) */
export async function loadFromPostgres(): Promise<void> {
  try {
    if ((await checkRagDb()) !== "up") return;
    await withClient(async (client) => {
      const res = await client.query<{
        session_id: string;
        username: string;
        workspace: string;
        created_at: Date;
      }>(`SELECT session_id, username, workspace, created_at FROM agent_sessions`);
      for (const row of res.rows) {
        ownership.set(row.session_id, {
          username: row.username,
          workspace: row.workspace,
          createdAt: new Date(row.created_at).toISOString(),
        });
      }
    });
    persistFile();
    console.log(`[sessionMap] loaded ${ownership.size} sessions from postgres`);
  } catch (err) {
    console.warn("[sessionMap] pg load failed:", err);
  }
}

export function claim(
  sessionId: string,
  username: string,
  workspace: string,
): void {
  const rec: SessionRecord = {
    username,
    workspace,
    createdAt: new Date().toISOString(),
  };
  ownership.set(sessionId, rec);
  persistFile();
  void persistPg(sessionId, rec);
}

export function release(sessionId: string): void {
  ownership.delete(sessionId);
  persistFile();
  void deletePg(sessionId);
}

export function ownerOf(sessionId: string): string | undefined {
  return ownership.get(sessionId)?.username;
}

export function recordOf(sessionId: string): SessionRecord | undefined {
  return ownership.get(sessionId);
}

export function listByUser(username: string): string[] {
  return [...ownership.entries()]
    .filter(([, rec]) => rec.username === username)
    .map(([id]) => id);
}

export function listRecordsByUser(
  username: string,
): Array<{ id: string } & SessionRecord> {
  return [...ownership.entries()]
    .filter(([, rec]) => rec.username === username)
    .map(([id, rec]) => ({ id, ...rec }));
}

export function assertOwner(sessionId: string, username: string): boolean {
  return ownership.get(sessionId)?.username === username;
}

export function allRecords(): Array<{ id: string } & SessionRecord> {
  return [...ownership.entries()].map(([id, rec]) => ({ id, ...rec }));
}

/** Test helper */
export function clearAll(): void {
  ownership.clear();
  try {
    if (fs.existsSync(mapFile())) fs.unlinkSync(mapFile());
  } catch {
    // ignore
  }
}
