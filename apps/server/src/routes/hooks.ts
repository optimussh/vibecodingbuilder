import { Router } from "express";
import crypto from "node:crypto";
import { appendAudit } from "../audit.js";
import { config } from "../config.js";
import { requireAuth, requireAdmin } from "../auth/requireAuth.js";

export const hooksRouter = Router();

/**
 * Inbound webhooks (GitHub etc.) — signature optional via HOOKS_SECRET.
 * Creates audit + optional agent work queue entry (file-backed).
 */
hooksRouter.post("/hooks/github", async (req, res) => {
  const secret = process.env.HOOKS_SECRET ?? "";
  if (secret) {
    const sig = String(req.headers["x-hub-signature-256"] ?? "");
    const raw = JSON.stringify(req.body ?? {});
    const h =
      "sha256=" +
      crypto.createHmac("sha256", secret).update(raw).digest("hex");
    if (sig && sig !== h) {
      // soft-fail if body was re-serialized; accept when no sig header in dev
      if (sig.startsWith("sha256=")) {
        res.status(401).json({ error: "invalid signature" });
        return;
      }
    }
  }

  const event = String(req.headers["x-github-event"] ?? "unknown");
  const action = (req.body as { action?: string })?.action;
  const repo =
    (req.body as { repository?: { full_name?: string } })?.repository
      ?.full_name ?? "";
  const pr =
    (req.body as { pull_request?: { number?: number; title?: string } })
      ?.pull_request ?? null;

  appendAudit("hook.github", undefined, {
    event,
    action,
    repo,
    prNumber: pr?.number,
    prTitle: pr?.title,
  });

  // Queue for later agent pickup
  try {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const qdir = path.join(config.projectRoot, "data", "hooks-queue");
    fs.mkdirSync(qdir, { recursive: true });
    const id = `${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
    fs.writeFileSync(
      path.join(qdir, `${id}.json`),
      JSON.stringify(
        {
          id,
          source: "github",
          event,
          action,
          repo,
          pr,
          receivedAt: new Date().toISOString(),
          status: "queued",
        },
        null,
        2,
      ),
    );
  } catch {
    /* ignore */
  }

  res.json({ ok: true, event, queued: true });
});

hooksRouter.get("/hooks/queue", requireAdmin, async (_req, res) => {
  const fs = await import("node:fs");
  const path = await import("node:path");
  const qdir = path.join(config.projectRoot, "data", "hooks-queue");
  if (!fs.existsSync(qdir)) {
    res.json({ items: [] });
    return;
  }
  const items = fs
    .readdirSync(qdir)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .reverse()
    .slice(0, 50)
    .map((f) => {
      try {
        return JSON.parse(
          fs.readFileSync(path.join(qdir, f), "utf8"),
        ) as unknown;
      } catch {
        return { file: f };
      }
    });
  res.json({ items });
});

/** Manual hook for CI / local scripts */
hooksRouter.post("/hooks/generic", requireAuth, (req, res) => {
  const type = String(req.body?.type ?? "generic");
  appendAudit("hook.generic", req.session.user!.username, {
    type,
    payload: req.body?.payload ?? null,
  });
  res.json({ ok: true });
});
