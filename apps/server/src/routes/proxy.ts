import { Router, type Request, type Response, type NextFunction } from "express";
import { createProxyMiddleware } from "http-proxy-middleware";
import { requireAuth } from "../auth/requireAuth.js";
import { config } from "../config.js";
import { ensureWorkspace } from "../workspace.js";
import * as sessionMap from "../sessionMap.js";
import { appendAudit } from "../audit.js";

export const proxyRouter = Router();

function workspaceOf(req: Request): string {
  const username = req.session.user!.username;
  return ensureWorkspace(config.workspacesRoot, username);
}

function requireAuthOrLogin(req: Request, res: Response, next: NextFunction) {
  if (req.session.user) {
    next();
    return;
  }
  // API clients get JSON; browsers get login redirect
  const accept = String(req.headers.accept ?? "");
  if (accept.includes("text/html")) {
    const nextPath = req.originalUrl || "/chamber";
    res.redirect(`/login?next=${encodeURIComponent(nextPath)}`);
    return;
  }
  res.status(401).json({ error: "Unauthorized" });
}

/**
 * Tenant hard-gate for OpenCode HTTP API:
 * - require login
 * - inject directory=user workspace
 * - block access to sessions not owned by user
 * - claim newly created sessions for the user
 */
proxyRouter.use("/opencode", requireAuth, (req, res, next) => {
  const username = req.session.user!.username;
  const workspace = workspaceOf(req);

  const m = req.path.match(/^\/session\/([^/]+)/);
  if (m) {
    const sid = m[1]!;
    if (sid && sid !== "status") {
      const rec = sessionMap.recordOf(sid);
      if (rec && rec.username !== username) {
        appendAudit("proxy.forbidden", username, { sessionId: sid });
        res.status(403).json({ error: "Forbidden: session not owned" });
        return;
      }
    }
  }

  const url = new URL(req.url, "http://local");
  if (!url.searchParams.has("directory")) {
    url.searchParams.set("directory", workspace);
    req.url = url.pathname + url.search;
  }

  // Capture session create responses to claim ownership
  if (req.method === "POST" && (req.path === "/session" || req.path === "/session/")) {
    const originalJson = res.json.bind(res);
    res.json = ((body: unknown) => {
      try {
        const id =
          body &&
          typeof body === "object" &&
          "id" in body &&
          typeof (body as { id: unknown }).id === "string"
            ? (body as { id: string }).id
            : undefined;
        if (id) {
          sessionMap.claim(id, username, workspace);
          appendAudit("proxy.session.claim", username, { sessionId: id });
        }
      } catch {
        // ignore claim errors
      }
      return originalJson(body);
    }) as typeof res.json;
  }

  next();
});

const opencodeProxy = createProxyMiddleware({
  target: config.opencodeBaseUrl,
  changeOrigin: true,
  pathRewrite: { "^/opencode": "" },
  ws: true,
  selfHandleResponse: false,
  on: {
    proxyReq: (proxyReq, req) => {
      const username = (req as Request).session?.user?.username;
      if (username) {
        const ws = ensureWorkspace(config.workspacesRoot, username);
        const pathWithQuery = proxyReq.path || "/";
        const u = new URL(pathWithQuery, config.opencodeBaseUrl);
        if (!u.searchParams.get("directory")) {
          u.searchParams.set("directory", ws);
          proxyReq.path = u.pathname + u.search;
        }
      }
    },
    proxyRes: (proxyRes, req) => {
      // Claim session on create when response is JSON body streamed — best-effort via header not available
      // Main claim is in res.json hook above; for raw proxy, parse on end if POST /session
      if (
        req.method === "POST" &&
        (req.url?.startsWith("/session") ||
          (req as Request).path === "/session" ||
          (req as Request).originalUrl?.includes("/opencode/session"))
      ) {
        const chunks: Buffer[] = [];
        const username = (req as Request).session?.user?.username;
        const workspace = username
          ? ensureWorkspace(config.workspacesRoot, username)
          : "";
        proxyRes.on("data", (c: Buffer) => chunks.push(c));
        proxyRes.on("end", () => {
          if (!username || !workspace) return;
          try {
            const text = Buffer.concat(chunks).toString("utf8");
            const body = JSON.parse(text) as { id?: string };
            if (body.id) {
              sessionMap.claim(body.id, username, workspace);
              appendAudit("proxy.session.claim", username, {
                sessionId: body.id,
              });
            }
          } catch {
            // non-json
          }
        });
      }
    },
    error: (err, _req, res) => {
      const r = res as Response;
      if (!r.headersSent) {
        r.status(502).json({
          error: "OpenCode proxy error",
          detail: err.message,
        });
      }
    },
  },
});

proxyRouter.use("/opencode", opencodeProxy);

/** Optional reverse proxy to OpenChamber UI/API when OPENCHAMBER_ENABLED=true */
export function mountOpenChamberProxy(app: import("express").Express): void {
  if (!config.openchamberEnabled || !config.openchamberUrl) {
    app.get("/chamber", requireAuthOrLogin, (_req, res) => {
      res.status(503).type("html").send(chamberNotReadyHtml());
    });
    app.get("/chamber/*path", requireAuthOrLogin, (_req, res) => {
      res.status(503).type("html").send(chamberNotReadyHtml());
    });
    return;
  }

  const chamberProxy = createProxyMiddleware({
    target: config.openchamberUrl,
    changeOrigin: true,
    ws: true,
    pathRewrite: { "^/chamber": "" },
    on: {
      error: (err, _req, res) => {
        const r = res as Response;
        if (!r.headersSent) {
          r.status(502)
            .type("html")
            .send(
              `<h1>OpenChamber proxy error</h1><pre>${err.message}</pre><p><a href="/">Portal</a></p>`,
            );
        }
      },
    },
  });

  app.use(
    "/chamber",
    requireAuthOrLogin,
    (req: Request, _res: Response, next: NextFunction) => {
      appendAudit("chamber.access", req.session.user?.username);
      next();
    },
    chamberProxy,
  );
}

function chamberNotReadyHtml(): string {
  return `<!doctype html>
<html lang="ko"><head><meta charset="utf-8"/><title>OpenChamber</title>
<style>body{font-family:system-ui;background:#0c0d10;color:#e8eaed;padding:2rem;max-width:40rem;margin:auto}
code{background:#15171c;padding:.15rem .4rem;border-radius:4px}a{color:#7c9cff}</style></head>
<body>
<h1>OpenChamber 아직 연결되지 않음</h1>
<p>게이트웨이는 준비됐습니다. 업스트림 OpenChamber를 띄운 뒤 <code>.env</code>에 설정하세요.</p>
<ol>
<li><code>pwsh scripts/fetch-openchamber.ps1</code></li>
<li><code>cd vendor/openchamber &amp;&amp; bun install &amp;&amp; bun run dev:web:hmr</code></li>
<li><code>OPENCHAMBER_ENABLED=true</code> · <code>OPENCHAMBER_URL=http://127.0.0.1:PORT</code></li>
<li>게이트웨이 재시작 후 <a href="/chamber">/chamber</a></li>
</ol>
<p><a href="/">← 포털</a> · <a href="http://localhost:5173">레거시 UI</a></p>
</body></html>`;
}
