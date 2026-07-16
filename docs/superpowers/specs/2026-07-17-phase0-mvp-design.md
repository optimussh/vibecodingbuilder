# Phase 0 MVP 설계 — Vibecoding Builder (Catalyst 제로베이스)

**일자:** 2026-07-17  
**상태:** 구현 플랜 작성 승인  
**근거 문서:** `docx/구축스펙.md` (Catalyst 오픈소스 스택 & 제로베이스 재구축 스펙)

## 1. 목표

**로컬 전용** MVP로 Catalyst 핵심 컨셉을 검증한다.

> 자연어 → AI 에이전트(OpenCode) → 유저별 워크스페이스에 실제 파일/코드 생성  
> 채팅 UX, SSE 스트리밍, 권한(permission) 게이트, 단순 멀티유저 인증 포함

재구축 로드맵의 **Phase 0** + 얇은 로컬 인증 레이어(Phase 1 단순화 버전).

### 성공 기준 (Done)

1. `user1` 로그인 → 채팅 → 본인 워크스페이스에 파일이 실제로 생성된다.
2. `user2`는 `user1` 경로·세션에 접근할 수 없다 (403).
3. 위험 툴 작업은 권한 카드가 뜨고, **Allow** 후에만 진행된다.
4. `admin`은 헬스, 시드 유저 목록, 감사 로그 tail을 볼 수 있다.
5. `GEMINI_API_KEY` 미설정 또는 OpenCode 미기동 상태가 UI/health에 드러난다.

## 2. 비범위 (명시적 컷)

| 이번 MVP에서 제외 | 이후 단계 |
|-------------------|-----------|
| LDAP / SSO | Phase 1 본편 |
| Docker 유저별 OS 격리 | Phase 2 |
| RAG, 문서 파서, 임베딩 | Phase 3 |
| 사내 앱 배포 PaaS | Phase 4 |
| 데스크톱 / VS Code 확장 | Phase 5 |
| 터미널(PTY) 풀 UI | 이후 |
| 고급 Git / Diff 뷰어 | 이후 |
| admin이 타 유저 라이브 에이전트 세션 가로채기 | 이후 |

## 3. 아키텍처

### 접근 방식

**Thin BFF + 커스텀 UI** (엔진은 트랙 A OpenCode, UI 셸은 자체 구현):

```
브라우저 (React :5173)
    │  쿠키 세션, JSON + SSE
    ▼
BFF (Express :3000)
    │  인증, 역할 게이트, 워크스페이스 매핑, 감사
    │  GEMINI_API_KEY 를 브라우저에 절대 노출하지 않음
    ▼
opencode serve (:4096, localhost 전용)
    │
    ▼
data/workspaces/{username}/
```

### 프로세스

| 프로세스 | 포트 | 역할 |
|----------|------|------|
| `apps/web` | 5173 | 로그인, 채팅, 세션, 권한 카드, 파일 트리, admin |
| `apps/server` | 3000 | 인증, 워크스페이스 격리, OpenCode 프록시, SSE 중계, 감사 |
| `opencode serve` | 4096 | 에이전트 엔진 (세션, 툴, 권한, 파일) |

### 핵심 규칙

1. 브라우저는 OpenCode에 **직접 연결하지 않는다**.
2. 유저별 워크스페이스: `data/workspaces/{username}/`.
3. Gemini 키는 서버/OpenCode 환경(`.env`)에만 둔다.
4. 경로 격리는 BFF에서 강제 (`path.resolve` + 루트 밖 거부). OS 컨테이너 격리는 Phase 2.

### 레포 구조

```
vibecodingbuilder/
├── apps/
│   ├── web/                 # Vite + React 19 + TS + Tailwind + Zustand
│   └── server/              # Express + 쿠키 세션 + @opencode-ai/sdk
├── data/
│   ├── workspaces/          # admin/, user1/, user2/  (gitignore)
│   └── audit/               # YYYY-MM-DD.jsonl       (gitignore)
├── docs/superpowers/specs/  # 본 문서
├── docx/구축스펙.md
├── .env.example
├── package.json             # npm workspaces
└── README.md
```

## 4. 인증 · 권한 · 데이터

### 시드 계정

| username | role | 비밀번호 출처 | 워크스페이스 |
|----------|------|---------------|--------------|
| `admin` | `admin` | `ADMIN_PASSWORD` (기본 `admin123`) | `data/workspaces/admin/` |
| `user1` | `user` | `USER1_PASSWORD` (기본 `user1`) | `data/workspaces/user1/` |
| `user2` | `user` | `USER2_PASSWORD` (기본 `user2`) | `data/workspaces/user2/` |

외부 DB 없음. 부팅 시 env/코드로 시드. 비밀번호는 bcrypt 비교(또는 해시된 env). 소스에 평문 하드코딩 금지.

### 세션

- HTTP-only 쿠키 세션 (`express-session` 또는 서명 쿠키).
- `SESSION_SECRET` 은 `.env`.
- 로컬: `SameSite=Lax`, `Secure=false`.
- 로그아웃 시 세션 폐기.

### 권한 매트릭스

| 동작 | `user` | `admin` |
|------|--------|---------|
| 자기 워크스페이스 채팅/파일 | 가능 | 가능 |
| 자기 OpenCode 세션 CRUD | 가능 | 가능 |
| 타 유저 워크스페이스/에이전트 세션 | 불가 | **불가** (MVP) |
| 시드 유저 목록 | 불가 | 가능 |
| 헬스 (BFF + OpenCode + LLM 설정 여부) | 가능 | 가능 |
| 감사 로그 열람 | 불가 | 가능 |

### 세션 소유권 맵

```
session-map: { [opencodeSessionId]: username }
```

- 세션 생성 시 기록.
- 모든 세션 API에서 `map[id] === req.user.username` 아니면 **403**.
- admin도 MVP에서는 타 유저 에이전트 세션에 접근하지 않는다.

### 감사 로그 (`data/audit/YYYY-MM-DD.jsonl`)

이벤트(메타데이터만 — 프롬프트 본문·API 키 저장 금지):

- `login`, `logout`
- `session.create`, `session.delete`
- `message.send`
- `permission.respond`
- `admin.audit.read`

### 환경변수 (`.env.example`)

```env
GEMINI_API_KEY=

PORT=3000
SESSION_SECRET=change-me
OPENCODE_BASE_URL=http://127.0.0.1:4096
OPENCODE_BIN=opencode
WORKSPACES_ROOT=./data/workspaces

ADMIN_PASSWORD=admin123
USER1_PASSWORD=user1
USER2_PASSWORD=user2
```

## 5. API · OpenCode 연동

### BFF 엔드포인트

| Method | Path | 설명 | 권한 |
|--------|------|------|------|
| POST | `/api/auth/login` | 세션 쿠키 설정 | public |
| POST | `/api/auth/logout` | 세션 폐기 | 로그인 |
| GET | `/api/auth/me` | `{ username, role }` | 로그인 |
| GET | `/api/health` | BFF + OpenCode + LLM 상태 | 로그인 |
| GET | `/api/sessions` | 내 세션 목록 | 로그인 |
| POST | `/api/sessions` | 세션 생성 (cwd = 내 워크스페이스) | 로그인 |
| GET | `/api/sessions/:id` | 세션 상세 | 소유자 |
| DELETE | `/api/sessions/:id` | 세션 삭제 | 소유자 |
| GET | `/api/sessions/:id/messages` | 메시지 목록 | 소유자 |
| POST | `/api/sessions/:id/messages` | 프롬프트 전송 (비동기 권장) | 소유자 |
| POST | `/api/sessions/:id/abort` | 실행 중단 | 소유자 |
| POST | `/api/sessions/:id/permissions/:permissionId` | Allow / Deny | 소유자 |
| GET | `/api/events` | OpenCode 이벤트 SSE 중계 | 로그인 |
| GET | `/api/fs` | 워크스페이스 파일 트리 | 로그인 |
| GET | `/api/fs/content?path=` | 파일 읽기 (경로 격리) | 로그인 |
| GET | `/api/admin/users` | 시드 유저 목록 | admin |
| GET | `/api/admin/audit` | 감사 로그 tail | admin |

### OpenCode

- 설치: `npm i -g opencode-ai` (README에 Windows 절차 포함).
- 기동: BFF가 `opencode serve --port 4096 --hostname 127.0.0.1` 스폰 **또는** `OPENCODE_BASE_URL`로 외부 프로세스 연결.
- 클라이언트: `@opencode-ai/sdk` → `createOpencodeClient({ baseUrl })`.
- LLM: `GEMINI_API_KEY`로 OpenCode Google/Gemini provider 인증·설정 주입.
- 스트리밍: OpenCode `/event`(SSE) → BFF가 세션 소유권 필터 → 브라우저 `EventSource` (`/api/events`).
- 권한: OpenCode permission 이벤트 → UI 카드 → BFF permission 응답 API.

### 명령 vs 스트림

- 명령: HTTP POST.
- 토큰 / 툴 진행 / 권한 요청: SSE.
- 재연결: 브라우저 `EventSource` 기본 재연결 (MVP). 지수 백오프는 선택 polish.

### 헬스 응답

```json
{
  "server": "ok",
  "opencode": "up" | "down",
  "llm": "configured" | "missing"
}
```

`opencode` down → 설치/기동 안내 UI.  
`llm` missing → `.env` 설정 안내.

### 에러 처리

| 상황 | 동작 |
|------|------|
| OpenCode 미기동 | health `down`, 채팅 API 명확한 503 |
| Gemini 키 없음 | health `missing`, 채팅 시 명확한 에러 |
| 경로 탈출 시도 | 403 + 감사 로그 |
| 타인 세션 | 403/404 |

## 6. UI

### 화면

| 화면 | 목적 |
|------|------|
| Login | username / password |
| Chat (메인) | 세션 목록, 스트림, 입력창 |
| Permission 카드 | Allow / Deny 오버레이 |
| Files 사이드 | 트리 + 읽기 전용 미리보기 |
| Admin | 유저, 헬스, 감사 로그 tail |
| Status bar | OpenCode · LLM 상태 표시 |

### 스택

- React 19 + TypeScript + Vite + Tailwind
- Zustand (세션/메시지/연결 상태)
- 개발 프록시: `/api` → `http://localhost:3000`

### 진입 URL

- 사용자 접속: **`http://localhost:5173`**
- `http://127.0.0.1:4096/` 브라우저 직접 접속 **불필요** (백엔드 전용)

## 7. 로컬 기동

```bash
npm install
cp .env.example .env   # GEMINI_API_KEY 입력
npm i -g opencode-ai
npm run dev            # server :3000 + web :5173 (+ 관리형 opencode)
```

## 8. 구현 메모

- 런타임: **Node 24** (Bun 불필요).
- Docker는 사용 가능하나 Phase 0 필수 아님.
- Git 저장소는 `vibecodingbuilder/` 프로젝트 루트에 둔다 (홈 디렉터리 git과 분리).
- 모듈 분리: `auth`, `workspace`, `opencode-client`, `sse`, `audit`, `fs`.
- 첫 로그인/부팅 시 워크스페이스 디렉터리 자동 생성.

## 9. 리스크와 대응

| 리스크 | 대응 |
|--------|------|
| OpenCode API 변경 | SDK 버전 고정, 서버 어댑터로 격리 |
| Windows OpenCode 설치 마찰 | `npm i -g opencode-ai` 문서화, health UI 안내 |
| 단일 OpenCode 프로세스 멀티유저 경합 | 세션 소유권 맵 + 세션별 cwd, OS 격리는 이후 |
| API 키 유출 | env 시크릿 응답 금지, 프록시만 사용 |

## 10. 다음 단계

본 스펙 사용자 검토 완료 후 **writing-plans**로 단계별 구현 플랜을 작성하고 구현에 착수한다.
