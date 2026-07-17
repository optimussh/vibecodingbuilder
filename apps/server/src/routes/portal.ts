import { Router } from "express";
import { config } from "../config.js";
import { getQuota } from "../quota.js";

export const portalRouter = Router();

portalRouter.get("/", (req, res) => {
  const user = req.session.user;
  const q = user ? getQuota(user.username) : null;
  res.type("html").send(`<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>Vibecoding Builder</title>
  <style>
    body{font-family:system-ui,sans-serif;background:#0c0d10;color:#e8eaed;margin:0;padding:2rem}
    .wrap{max-width:44rem;margin:0 auto}
    a.card{display:block;border:1px solid #2a2e38;background:#15171c;border-radius:12px;
      padding:1rem 1.2rem;margin:.6rem 0;color:#e8eaed;text-decoration:none}
    a.card:hover{border-color:#7c9cff}
    .muted{color:#9aa0a6;font-size:.9rem}
    code{background:#0a0b0e;padding:.1rem .35rem;border-radius:4px}
    h1{font-size:1.4rem}
    .dot{display:inline-block;width:.55rem;height:.55rem;border-radius:50%;margin-right:.35rem}
    .up{background:#3dd68c}.down{background:#f87171}.unk{background:#6b7280}
    #stack{font-family:ui-monospace,Consolas,monospace;font-size:.78rem;color:#9aa0a6;
      background:#0a0b0e;border-radius:8px;padding:.75rem;margin:1rem 0;white-space:pre-wrap}
    button{background:#2a2e38;border:0;color:#e8eaed;padding:.4rem .7rem;border-radius:6px;cursor:pointer}
  </style>
</head>
<body>
  <div class="wrap">
    <h1>Vibecoding Builder</h1>
    <p class="muted">로컬 풀스택 · 포트 자동 연계 · OpenCode :4096 · Chamber :3001 · Platform :${config.port}</p>
    ${
      user
        ? `<p>로그인: <strong>${user.username}</strong> (${user.role})
           ${q ? ` · 오늘 메시지 ${q.used}/${q.limit || "∞"}` : ""}
           <button onclick="fetch('/api/auth/logout',{method:'POST',credentials:'include'}).then(()=>location.reload())">Logout</button></p>`
        : `<p class="muted"><a href="/login?next=/chamber">로그인</a> 후 Chamber · 계정 admin/user1/user2</p>`
    }
    <div id="stack">스택 상태 로딩…</div>
    <a class="card" href="http://127.0.0.1:5173/"><strong>채팅 UI (레거시) — 채팅창 여기</strong><br/>
      <span class="muted">로그인 → 세션 목록 · 메시지 · 입력창 · RAG. 포트 5173</span></a>
    <a class="card" href="/chamber"><strong>OpenChamber IDE</strong><br/>
      <span class="muted">로그인 후 :3001 로 이동 (채팅 셸). <code>npm run chamber</code> 필요</span></a>
    <a class="card" href="http://127.0.0.1:3001/"><strong>OpenChamber 직접 (:3001)</strong><br/>
      <span class="muted">정적 파일 정상 로드 · OpenCode :4096 공유</span></a>
    <a class="card" href="/docs/status/index.html"><strong>진행 현황 보드</strong><br/>
      <span class="muted">기능 · 왜 · 다음 방향</span></a>
    <a class="card" href="/api/stack"><strong>Stack JSON</strong><br/>
      <span class="muted">포트 맵 · 서비스 up/down</span></a>
    <p class="muted">기동: <code>npm run dev:all</code> (postgres + platform + web + chamber)</p>
  </div>
  <script>
    (async () => {
      try {
        const s = await fetch('/api/stack').then(r => r.json());
        const svc = s.services || {};
        const line = (name, st) => {
          const cls = st === 'up' || st === 'configured' || st === 'enabled' ? 'up'
            : st === 'missing' || st === 'disabled' ? 'unk' : 'down';
          return '<div><span class="dot ' + cls + '"></span>' + name + ': ' + st + '</div>';
        };
        document.getElementById('stack').innerHTML =
          Object.entries(svc).map(([k,v]) => line(k, v)).join('') +
          '\\nports ' + JSON.stringify(s.ports) +
          '\\n' + (s.wiring ? JSON.stringify(s.wiring) : '');
      } catch (e) {
        document.getElementById('stack').textContent = 'stack probe failed: ' + e;
      }
    })();
  </script>
</body>
</html>`);
});
