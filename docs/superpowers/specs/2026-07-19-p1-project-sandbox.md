# P1.3 / P1.4 — Project Workspaces + ACL + Sandbox v1

**Product:** CodeHarbor  
**Parent:** [2026-07-19-codeharbor-moat-roadmap.md](./2026-07-19-codeharbor-moat-roadmap.md)  
**Status:** Ready for implementation  
**Depends on:** app_users / admin role ([p1-admin-sso](./2026-07-19-p1-admin-sso.md)) 권장  
**Moat:** A (데이터), B (정책), C (운영)

---

## 1. Goals

| ID | Goal |
|----|------|
| G1 | 개인 홈 워크스페이스 외에 **프로젝트 단위 공유 워크스페이스** |
| G2 | 프로젝트 멤버십(ACL)으로 읽기/쓰기/에이전트 실행 권한 제어 |
| G3 | 에이전트 실행을 **샌드박스 v1**(Docker 우선)에서 수행 가능 |
| G4 | 기존 per-user `data/workspaces/{user}` 경로는 유지 (개인 스크래치) |

### Non-goals (P1)

- K8s / gVisor / Firecracker  
- 네트워크 마이크로세그멘테이션 UI 전부  
- 멀티 리전 볼륨  

---

## 2. Current state

| 있음 | 없음 |
|------|------|
| `data/workspaces/{username}` | Project entity |
| sessionMap: session → user + workspace path | 멤버십 ACL |
| OpenCode `directory` 주입 | Docker sandbox lifecycle |
| path traversal 차단 (fs routes) | 프로젝트 bind API |

---

## 3. Concepts

```
User ──┐
       ├── personal workspace:  data/workspaces/{username}
       └── member of Project ──► project workspace: data/projects/{projectId}/
                                      │
                                      ▼
                               Sandbox container
                               (cwd = project or personal root)
```

**Personal:** 항상 존재, 본인만 R/W.  
**Project:** 생성자=owner, 멤버 초대, 공유 코드베이스.

---

## 4. Data model

```sql
CREATE TABLE IF NOT EXISTS projects (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug          TEXT UNIQUE NOT NULL,       -- url-safe
  name          TEXT NOT NULL,
  description   TEXT,
  root_path     TEXT NOT NULL,              -- absolute
  created_by    TEXT NOT NULL,
  sandbox_mode  TEXT NOT NULL DEFAULT 'off'
                  CHECK (sandbox_mode IN ('off','docker')),
  network_mode  TEXT NOT NULL DEFAULT 'none'
                  CHECK (network_mode IN ('none','internal','full')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS project_members (
  project_id    UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  username      TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'developer'
                  CHECK (role IN ('owner','developer','viewer')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (project_id, username)
);
```

### ACL matrix

| Action | owner | developer | viewer |
|--------|-------|-----------|--------|
| list/read files | ✓ | ✓ | ✓ |
| write/upload | ✓ | ✓ | ✗ |
| agent prompt | ✓ | ✓ | ✗ |
| manage members | ✓ | ✗ | ✗ |
| delete project | ✓ | ✗ | ✗ |
| start sandbox | ✓ | ✓ | ✗ |

---

## 5. Filesystem layout

```
data/
  workspaces/
    admin/
    user1/
    user2/
  projects/
    {uuid}/
      .codeharbor.json      # { id, slug, name }
      AGENTS.md
      README.md
      ... user code ...
```

`ensureProjectDir(id)` creates dir + markers (mirror `workspaceBootstrap`).

---

## 6. API

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/projects` | user | 내가 멤버인 프로젝트 |
| POST | `/api/projects` | user | `{ name, slug? }` → owner=me |
| GET | `/api/projects/:id` | member | meta + my role |
| PATCH | `/api/projects/:id` | owner | name, sandbox_mode, network_mode |
| DELETE | `/api/projects/:id` | owner | soft or hard (P1: hard + fs delete opt) |
| GET | `/api/projects/:id/members` | member | list |
| POST | `/api/projects/:id/members` | owner | `{ username, role }` |
| DELETE | `/api/projects/:id/members/:username` | owner | |
| POST | `/api/projects/:id/bind` | developer+ | bootstrap + OC session in project root |
| GET | `/api/fs?projectId=` | member | tree scoped to project |
| POST | `/api/sandbox/start` | developer+ | `{ projectId? }` personal if omit |
| POST | `/api/sandbox/stop` | developer+ | |
| GET | `/api/sandbox/status` | user | |

### Bind response (extends workspace bind)

```json
{
  "projectId": "...",
  "workspace": "/abs/path/data/projects/...",
  "sessionId": "...",
  "chamberPath": "/chamber/?directory=...&sessionId=...",
  "sandbox": { "mode": "docker", "status": "running|off" }
}
```

---

## 7. Sandbox v1 (Docker)

### Design

- Image: configurable `SANDBOX_IMAGE` (default `node:22-bookworm` or distroless+tools later)  
- Mount: workspace root → `/workspace` (rw for developer)  
- OpenCode remains on host **or** in-container proxy (P1 권장: **host OpenCode + directory = host path**, sandbox for **user-preview / shell tools** only)

**P1 pragmatic split:**

| Workload | Where |
|----------|--------|
| LLM agent file edits via OpenCode | Host path, ACL-enforced (existing) |
| `npm run` / preview / untrusted script | Docker sandbox |
| Network | `none` default; `full` admin-only toggle |

Later P2: full agent-in-sandbox.

### Docker run sketch

```
docker run -d --name ch-sbx-{user}-{id}
  --network none|bridge
  -v {workspace}:/workspace
  -w /workspace
  --memory 2g --cpus 2
  {SANDBOX_IMAGE} sleep infinity
```

Gateway tracks container id in memory + optional PG.

### Failure modes

- Docker daemon down → `sandbox_mode=docker` 요청 시 503 + personal path still usable with warning  
- Windows: Docker Desktop required; document WSL2 backend  

---

## 8. Enforcement points

1. **fs / upload / git / rag:** resolve root via `projectId` query or default personal; check membership  
2. **sessions create/prompt:** `directory` must equal allowed root for user  
3. **proxy /opencode:** inject directory only if path under allowed roots  
4. **chamber auto-open:** bind returns project directory  

```ts
function allowedRoots(username: string): string[] {
  return [personalRoot(username), ...projectRootsFor(username)]
}
function assertPathAllowed(username: string, absPath: string): void
```

---

## 9. UI

- Portal / Chat: **Projects** 드롭다운 (Personal | Project list)  
- Create project modal  
- Members page (owner)  
- Sandbox indicator: Off / Running / Error  
- Chamber open uses **active project** bind  

---

## 10. Acceptance tests

| # | Case | Expected |
|---|------|----------|
| T1 | user2 not member of project A | GET files 403 |
| T2 | viewer cannot POST message | 403 |
| T3 | developer bind creates session under project path | directory match |
| T4 | path traversal to other project | 403 |
| T5 | sandbox start without docker | 503 clear error |
| T6 | sandbox start with docker | status running, mount ok |
| T7 | personal workspace still works | regression pass |

---

## 11. Implementation plan (PRs)

1. **PR-A:** projects + members tables, CRUD API, FS root resolver  
2. **PR-B:** bind + sessionMap workspace = project path  
3. **PR-C:** UI project switcher  
4. **PR-D:** sandbox manager (docker) + status API  
5. **PR-E:** isolation tests for projects  

---

## 12. Config

```env
PROJECTS_ROOT=./data/projects
SANDBOX_ENABLED=true
SANDBOX_IMAGE=node:22-bookworm
SANDBOX_MEMORY=2g
SANDBOX_CPUS=2
SANDBOX_DEFAULT_NETWORK=none
```

---

## 13. Open questions

1. 프로젝트 삭제 시 FS 즉시 삭제 vs soft-delete 30일?  
2. 외부 Git remote clone-on-create? (P1 optional)  
3. OpenCode fully inside container timeline?
