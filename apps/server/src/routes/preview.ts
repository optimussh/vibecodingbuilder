import { Router } from "express";
import { createProxyMiddleware } from "http-proxy-middleware";
import { requireAuth } from "../auth/requireAuth.js";
import {
  getPreview,
  listPreviews,
  startPreview,
  stopPreview,
} from "../preview/manager.js";
import { appendAudit } from "../audit.js";
import { requireAdmin } from "../auth/requireAuth.js";

export const previewRouter = Router();

previewRouter.get("/preview", requireAuth, (req, res) => {
  const p = getPreview(req.session.user!.username);
  if (!p) {
    res.json({ running: false });
    return;
  }
  res.json({
    running: true,
    port: p.port,
    command: p.command,
    cwd: p.cwd,
    startedAt: p.startedAt,
    url: `/preview/app/`,
    direct: `http://127.0.0.1:${p.port}/`,
  });
});

previewRouter.post("/preview/start", requireAuth, async (req, res) => {
  try {
    const username = req.session.user!.username;
    const command =
      typeof req.body?.command === "string" ? req.body.command : undefined;
    const p = await startPreview(username, { command });
    appendAudit("preview.start", username, {
      port: p.port,
      command: p.command,
    });
    res.status(201).json({
      running: true,
      port: p.port,
      command: p.command,
      cwd: p.cwd,
      url: `/preview/app/`,
      direct: `http://127.0.0.1:${p.port}/`,
    });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

previewRouter.post("/preview/stop", requireAuth, (req, res) => {
  const username = req.session.user!.username;
  const ok = stopPreview(username);
  appendAudit("preview.stop", username, { ok });
  res.json({ ok });
});

previewRouter.get("/admin/previews", requireAdmin, (_req, res) => {
  res.json({ previews: listPreviews() });
});

/** Authenticated reverse proxy to user's preview server */
export function mountPreviewProxy(app: import("express").Express): void {
  app.use(
    "/preview/app",
    requireAuth,
    (req, res, next) => {
      const p = getPreview(req.session.user!.username);
      if (!p) {
        res
          .status(404)
          .type("html")
          .send(
            `<h1>No preview running</h1><p>POST /api/preview/start first, or use the portal.</p><a href="/">Portal</a>`,
          );
        return;
      }
      // stash port on req for proxy router
      (req as typeof req & { previewPort?: number }).previewPort = p.port;
      next();
    },
    createProxyMiddleware({
      target: "http://127.0.0.1:9", // overwritten in router
      router: (req) => {
        const port = (req as typeof req & { previewPort?: number }).previewPort;
        return `http://127.0.0.1:${port ?? 9}`;
      },
      changeOrigin: true,
      pathRewrite: { "^/preview/app": "" },
      ws: true,
      on: {
        error: (err, _req, res) => {
          const r = res as import("express").Response;
          if (!r.headersSent) {
            r.status(502).send(`Preview proxy error: ${err.message}`);
          }
        },
      },
    }),
  );
}
