import fs from "node:fs";
import path from "node:path";
import { config } from "./config.js";
import { checkRagDb, withClient } from "./rag/db.js";

export interface AuditEvent {
  ts: string;
  action: string;
  username?: string;
  meta?: Record<string, unknown>;
}

function todayFile(): string {
  const day = new Date().toISOString().slice(0, 10);
  return path.join(config.auditDir, `${day}.jsonl`);
}

export function appendAudit(
  action: string,
  username?: string,
  meta?: Record<string, unknown>,
): void {
  fs.mkdirSync(config.auditDir, { recursive: true });
  const event: AuditEvent = {
    ts: new Date().toISOString(),
    action,
    username,
    meta,
  };
  fs.appendFileSync(todayFile(), `${JSON.stringify(event)}\n`, "utf8");
  void appendAuditPg(event);
}

async function appendAuditPg(event: AuditEvent): Promise<void> {
  try {
    if ((await checkRagDb()) !== "up") return;
    await withClient(async (client) => {
      await client.query(
        `INSERT INTO audit_events (ts, action, username, meta)
         VALUES ($1::timestamptz, $2, $3, $4::jsonb)`,
        [
          event.ts,
          event.action,
          event.username ?? null,
          JSON.stringify(event.meta ?? {}),
        ],
      );
    });
  } catch {
    // fail-open: file log is enough
  }
}

export function readAuditTail(limit = 100): AuditEvent[] {
  // Prefer postgres when available — sync read falls back to file
  return readAuditTailFile(limit);
}

export async function readAuditTailAsync(limit = 100): Promise<AuditEvent[]> {
  try {
    if ((await checkRagDb()) === "up") {
      return await withClient(async (client) => {
        const res = await client.query<{
          ts: Date;
          action: string;
          username: string | null;
          meta: Record<string, unknown> | null;
        }>(
          `SELECT ts, action, username, meta
           FROM audit_events
           ORDER BY ts DESC
           LIMIT $1`,
          [limit],
        );
        return res.rows.map((r) => ({
          ts: new Date(r.ts).toISOString(),
          action: r.action,
          username: r.username ?? undefined,
          meta: r.meta ?? undefined,
        }));
      });
    }
  } catch {
    // fall through
  }
  return readAuditTailFile(limit);
}

function readAuditTailFile(limit: number): AuditEvent[] {
  fs.mkdirSync(config.auditDir, { recursive: true });
  const files = fs
    .readdirSync(config.auditDir)
    .filter((f) => f.endsWith(".jsonl"))
    .sort()
    .reverse();

  const events: AuditEvent[] = [];
  for (const file of files) {
    const content = fs.readFileSync(path.join(config.auditDir, file), "utf8");
    const lines = content
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .reverse();
    for (const line of lines) {
      try {
        events.push(JSON.parse(line) as AuditEvent);
      } catch {
        // skip
      }
      if (events.length >= limit) return events;
    }
  }
  return events;
}
