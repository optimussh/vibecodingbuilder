# Progress

프로젝트 진행 현황 로그. 커밋 직전 갱신 (`claude_Template-main/rules/common/git.md`).

사람용 요약 보드: [`docs/status/index.html`](docs/status/index.html)

---

## 2026-07-17

### P0–P3 배치 (OpenChamber 프로덕션 전환)

#### P0 — 문서 · 원격 · 스파이크

- **What:** `PROGRESS.md`, `docs/status/index.html`, `scripts/fetch-openchamber.ps1`, `vendor/PIN.md` + SHA pin, OpenChamber shallow clone.
- **Why:** 진행 추적·재현 가능한 벤더 핀·GitHub 푸시 기반.
- **Spike:** OpenChamber pin `3bc8919…` · Windows `bun install`은 sharp/node-gyp(VS C++)로 실패 → `--ignore-scripts` 또는 WSL 권장.
- **Status:** done

#### P1 — 게이트웨이 포털 · Chamber 프록시 골격

- **What:** `/` 포털, `/chamber` (auth + reverse proxy 또는 설정 안내), `/docs/status` 정적 서빙.
- **Why:** 단일 진입점 + OpenChamber 연결 자리 확보 (업스트림 기동 시 스위치).
- **Status:** done (코드) · OC UI 실기동은 Windows 네이티브 제약 시 WSL

#### P2 — Tenant hard gate 프록시

- **What:** `/opencode/*` 인증 필수, `directory` 주입, 타인 세션 403, audit.
- **Why:** 브라우저→OpenCode 직행 차단·격리 강제.
- **Status:** done

#### P3 — 쿼터 · 문서 · 하드닝 1차

- **What:** 일일 메시지 쿼터 (`data/quota.json`, `GET /api/quota`), 채팅 429, 상태 보드 갱신.
- **Why:** 거버넌스 미니 + 프로덕션 로컬 1.0 체크리스트.
- **Status:** done (로컬 1.0 플랫폼 측)

#### P3+ — OpenChamber 실기동 연결 (Windows)

- **What:** `bun install --ignore-scripts` + `build:ui`/`build:web` 성공, OpenChamber `:3001` 기동, 게이트웨이 `/chamber` 프록시 200, `/login` HTML, `/opencode` 테넌트 프록시 health, `scripts/start-openchamber.ps1`.
- **Why:** 프로덕션 셸을 레거시 UI만이 아니라 OpenChamber로도 진입 가능하게.
- **Status:** done (스모크: chamber HTML 200, opencode proxy healthy, 비로그인 401)

#### 포트 자동 연계 · dev:all

- **What:** `npm run dev:all` / `scripts/dev-all.ps1` — postgres + platform(:3000) + OpenCode(:4096) + web(:5173) + chamber(:3001). Chamber는 `OPENCODE_SKIP_START`로 **단일 OpenCode :4096** 공유. `/api/stack` 포트 맵, 포털 실시간 상태.
- **Why:** 수동 포트 맞추기 없이 로컬 풀스택 기동.
- **Status:** done (chamber log: external OpenCode 4096)

#### 채팅 안 보이던 문제 수정

- **What:** `/chamber` path-proxy는 SPA 절대경로 `/assets` 를 깨뜨려 빈 화면 → 로그인 후 **:3001 직접 런치 페이지**로 변경. 레거시 채팅 로그인 후 `navigate('/')`, 세션 자동 생성, 포털에 “채팅 UI :5173” 강조.
- **Why:** “로그인만 되고 채팅창 없음” 은 버그였음 (정상 아님).
- **Status:** done

### 이전 완료 (MVP)

| 커밋 | 내용 |
|------|------|
| `14d7b3d` | 패널 리사이즈 UX |
| `9ed8d18` | Phase 3 RAG 미니 |
| `9598fef` | Phase 1 workspace 격리 |
| `96a7cab` | Phase 0 BFF + UI + OpenCode |
