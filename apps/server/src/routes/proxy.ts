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

/**
 * OpenChamber SPA uses absolute asset paths (/assets/...).
 * Path-prefix reverse proxy (/chamber → :3001) breaks JS/CSS load → blank UI.
 * Local fix: after auth, **redirect** to direct OpenChamber origin (default :3001).
 */
export function mountOpenChamberProxy(app: import("express").Express): void {
  const handler = (req: Request, res: Response) => {
    if (!config.openchamberEnabled || !config.openchamberUrl) {
      res.status(503).type("html").send(chamberNotReadyHtml());
      return;
    }
    appendAudit("chamber.redirect", req.session.user?.username);
    const target = config.openchamberUrl.replace(/\/$/, "");
    // Prefer HTML bridge so user understands two UIs (legacy chat vs chamber)
    const accept = String(req.headers.accept ?? "");
    if (accept.includes("text/html") || req.method === "GET") {
      res.type("html").send(chamberLaunchHtml(target));
      return;
    }
    res.redirect(302, target);
  };

  app.get("/chamber", requireAuthOrLogin, handler);
  app.get("/chamber/*path", requireAuthOrLogin, handler);
}

function chamberLaunchHtml(target: string): string {
  return `<!doctype html>
<html lang="ko"><head><meta charset="utf-8"/>
<title>OpenChamber · workspace bind</title>
<style>
body{font-family:system-ui;background:#0c0d10;color:#e8eaed;padding:2rem;max-width:40rem;margin:auto;line-height:1.5}
a{color:#7c9cff} .card{border:1px solid #2a2e38;background:#15171c;border-radius:12px;padding:1rem;margin:1rem 0}
code,pre{background:#0a0b0e;padding:.15rem .4rem;border-radius:4px;font-size:.85rem}
pre{padding:.75rem;overflow:auto;white-space:pre-wrap}
.muted{color:#9aa0a6;font-size:.9rem}
button{background:#4f6ef7;color:#fff;border:0;padding:.55rem 1rem;border-radius:8px;cursor:pointer;font-weight:600}
</style></head>
<body>
  <h1>워크스페이스 연결 중…</h1>
  <p class="muted">유저 전용 폴더를 준비한 뒤 OpenChamber(:3001)로 이동합니다.
  (경로 프록시는 SPA 자산을 깨뜨리므로 직접 포트를 엽니다.)</p>
  <div class="card" id="status">bind 호출 중…</div>
  <div class="card">
    <p><a id="open" href="${target}"><strong>OpenChamber 열기 →</strong></a></p>
    <p class="muted">Chamber에서 프로젝트로 이 폴더를 여세요 (아래 경로).</p>
    <pre id="ws">…</pre>
    <button type="button" onclick="navigator.clipboard.writeText(document.getElementById('ws').textContent)">경로 복사</button>
  </div>
  <div class="card">
    <p><strong>빠른 채팅 (레거시)</strong></p>
    <p><a href="http://127.0.0.1:5173/">http://127.0.0.1:5173/</a></p>
  </div>
  <p><a href="/">← 포털</a></p>
  <script>
    (async () => {
      const target = ${JSON.stringify(target)};
      try {
        const r = await fetch('/api/workspace/bind', {
          method: 'POST', credentials: 'include',
          headers: { 'Content-Type': 'application/json' }, body: '{}'
        });
        const data = await r.json();
        if (!r.ok) throw new Error(data.error || 'bind failed');
        document.getElementById('status').textContent =
          '연결됨 · session=' + (data.sessionId || 'none') + ' · OpenCode directory 고정';
        document.getElementById('ws').textContent = data.workspace || '';
        // Open Chamber after short delay so user can read path
        setTimeout(() => { location.href = target; }, 600);
      } catch (e) {
        document.getElementById('status').textContent = 'bind 실패: ' + e.message + ' — Chamber는 직접 엽니다.';
        document.getElementById('ws').textContent = '(워크스페이스 경로를 포털에서 확인)';
        setTimeout(() => { location.href = target; }, 1200);
      }
    })();
  </script>
</body></html>`;
}

function chamberNotReadyHtml(): string {
  return `<!doctype html>
<html lang="ko"><head><meta charset="utf-8"/><title>OpenChamber</title>
<style>body{font-family:system-ui;background:#0c0d10;color:#e8eaed;padding:2rem;max-width:40rem;margin:auto}
code{background:#15171c;padding:.15rem .4rem;border-radius:4px}a{color:#7c9cff}</style></head>
<body>
<h1>OpenChamber 아직 연결되지 않음</h1>
<p>채팅(레거시): <a href="http://127.0.0.1:5173/">http://127.0.0.1:5173/</a></p>
<p>Chamber 기동: <code>npm run chamber</code> (OpenCode :4096 필요)</p>
<p><a href="/">← 포털</a></p>
</body></html>`;
}
