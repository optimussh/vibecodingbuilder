import bcrypt from "bcryptjs";
import { checkRagDb, withClient } from "./rag/db.js";
import {
  getUsers,
  findUser,
  type AppUser,
} from "./users.js";
import type { Role } from "./types.js";
import { log } from "./log.js";

/** Sync in-memory users → PG and reload extras from PG */
export async function syncUsersWithPostgres(): Promise<void> {
  try {
    if ((await checkRagDb()) !== "up") return;
    await withClient(async (client) => {
      for (const u of getUsers()) {
        await client.query(
          `INSERT INTO app_users (username, role, password_hash, disabled, daily_quota, updated_at)
           VALUES ($1,$2,$3,$4,$5,now())
           ON CONFLICT (username) DO UPDATE SET
             role = EXCLUDED.role,
             password_hash = COALESCE(EXCLUDED.password_hash, app_users.password_hash),
             disabled = EXCLUDED.disabled,
             daily_quota = EXCLUDED.daily_quota,
             updated_at = now()`,
          [
            u.username,
            u.role,
            u.passwordHash,
            u.disabled ?? false,
            u.dailyQuota ?? null,
          ],
        );
      }
      const res = await client.query<{
        username: string;
        role: string;
        password_hash: string | null;
        disabled: boolean;
        daily_quota: number | null;
      }>(`SELECT username, role, password_hash, disabled, daily_quota FROM app_users`);
      for (const row of res.rows) {
        const existing = findUser(row.username);
        if (existing) {
          existing.role = row.role as Role;
          existing.disabled = row.disabled;
          existing.dailyQuota = row.daily_quota;
          if (row.password_hash) existing.passwordHash = row.password_hash;
        } else if (row.password_hash) {
          getUsers().push({
            username: row.username,
            role: (row.role as Role) || "user",
            passwordHash: row.password_hash,
            disabled: row.disabled,
            dailyQuota: row.daily_quota,
          } satisfies AppUser);
        }
      }
    });
    log.info("users synced with postgres");
  } catch (err) {
    log.warn({ err }, "users pg sync failed");
  }
}

export async function persistUser(u: AppUser): Promise<void> {
  try {
    if ((await checkRagDb()) !== "up") return;
    await withClient(async (client) => {
      await client.query(
        `INSERT INTO app_users (username, role, password_hash, disabled, daily_quota, updated_at)
         VALUES ($1,$2,$3,$4,$5,now())
         ON CONFLICT (username) DO UPDATE SET
           role = EXCLUDED.role,
           password_hash = EXCLUDED.password_hash,
           disabled = EXCLUDED.disabled,
           daily_quota = EXCLUDED.daily_quota,
           updated_at = now()`,
        [
          u.username,
          u.role,
          u.passwordHash,
          u.disabled ?? false,
          u.dailyQuota ?? null,
        ],
      );
    });
  } catch {
    /* ignore */
  }
}

export function hashPassword(password: string): string {
  return bcrypt.hashSync(password, 10);
}
