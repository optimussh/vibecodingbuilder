# CodeHarbor — 경제적 해자 · 독립 영역 · 로드맵 · 스펙 골격

**Status:** Draft for product steering (2026-07-19)  
**Product:** CodeHarbor  
**Category:** Governed Vibe Coding Platform  
**Audience:** 제품/엔지니어링/세일즈 정렬용

---

## 1. 한 줄 전략

> **개인 AI IDE와 싸우지 않는다.**  
> 기업이 바이브코딩을 **허용·표준화·감사·과금**할 수 있는 **통제 평면(control plane)** 을 판다.

| 우리가 파는 것 | 우리가 팔지 않는 것 |
|----------------|---------------------|
| 멀티테넌트 게이트웨이 + 격리 워크스페이스 | Cursor/Kiro “더 똑똑한 에디터” 완전체 |
| 키·정책·감사·쿼터의 중앙화 | 모델 성능 자체 |
| 온프렘/사내망 설치형 운영 | 순수 퍼블릭 SaaS 코딩 에이전트 (1인) |

---

## 2. 벤치마킹 매트릭스 (요지)

채점: ● 강함 · ◐ 부분 · ○ 약/없음 · — 해당 없음

| 축 | Kiro | Cursor | Claude Code | AgentHarbor 계열 | Copilot Ent | **CodeHarbor (현재→목표)** |
|----|------|--------|-------------|------------------|--------------|---------------------------|
| Spec→Task 루프 | ● | ◐ | ◐ | ◐ | ○ | ○→◐→● |
| 개인 DX / IDE 깊이 | ● | ● | ● | ● | ● | ◐ (OpenChamber 의존) |
| **멀티유저 테넌시** | ○ | ○ | ○ | ○ | ◐ org | **●→●** |
| **BFF 키 비노출** | ○ | ○ | ○ | ◐ | ● | **●** |
| **워크스페이스 격리** | ○ | ○ | worktree | sandbox | ◐ | **●→샌드박스 ●** |
| **감사/쿼터** | ○ | ○ | ○ | ○ | ● | **◐→●** |
| SSO/RBAC | ○ | ◐ Team | ○ | ○ | ● | ○→● |
| RAG 사내 지식 | ◐ | ● codebase | ◐ | ○ | ● | ◐→● |
| Hooks/CI 에이전트 | ● | ◐ | ◐ | ◐ | ● | ○→● |
| 온프렘/에어갭 | ○ | ○ | ◐ local | ◐ | ◐ | **● (목표 핵심)** |
| 가격 통제/비용 가시성 | ○ | ◐ | ○ | ○ | ● | ○→● |

### 벤치에서 얻은 결론

1. **빈 칸(whitespace):** “팀·보안·온프렘”이 동시에 있는 **거버넌스형 바이브코딩 런타임**  
2. **따라가면 지는 축:** 순수 에디터 UX, 모델 속도, 개인 생산성 플러그인 전쟁  
3. **이기려면 깊게 팔 축:** 격리 · 정책 엔진 · 감사 · 비용 · 설치형 · 프로젝트 단위 운영  

---

## 3. 경제적 해자 (Moat) — 무엇을 쌓을지

해자는 “기능 하나”가 아니라 **전환비용 + 데이터 + 정책 임베딩 + 유통**의 결합이다.

### 3.1 구조적 해자 (쌓을 것)

| 해자 | 메커니즘 | 방어하는 경쟁 |
|------|----------|----------------|
| **A. 테넌시 데이터 그래비티** | 프로젝트 워크스페이스, 세션 맵, 감사 로그, RAG 코퍼스, steering 규칙이 사내 DB에 축적 | 개인 SaaS로 이전 시 감사·지식 유실 |
| **B. 정책 임베딩** | SSO 그룹↔역할, 모델 허용 목록, 경로/네트워크 정책, 쿼터가 IdP·IT 프로세스에 묶임 | “팀원 각자 Cursor”로 우회 비용↑ |
| **C. 운영 런북 잠금** | 설치 아티팩트, 백업, 업그레이드, 보안 리뷰 통과 문서 | 스타트업 툴 교체 시 보안 재심사 |
| **D. 템플릿·스킬 마켓 (내부)** | 팀 표준 스택 원클릭, 사내 MCP/스킬 | 신규 툴은 빈 환경부터 다시 |
| **E. 유통 (IT/보안 예산)** | “개발 생산성”이 아니라 **리스크·컴플라이언스 예산**에도 걸림 | 개발팀 카드 결제 SaaS와 다른 구매 경로 |

### 3.2 약한 해자 / 함정 (쌓지 말 것·의존 관리)

| 항목 | 리스크 | 대응 |
|------|--------|------|
| OpenCode / OpenChamber 업스트림 | 상품 차별화가 셸에만 있으면 교체 가능 | **게이트웨이·정책·테넌시**를 코어 IP로 |
| 모델 API | 누구나 Gemini/Claude 연결 가능 | 모델은 플러그인, 가치는 통제 평면 |
| “바이브” 유행 키워드 | 범용화·가벼움 | **Governed** 수식어 고정 |
| 단일 레포 해킹 도구 이미지 | 엔터프라이즈 신뢰↓ | Pilot 패키지·보안 1페이지 필수 |

### 3.3 해자 점수 목표 (12개월)

| 해자 | 지금 | 12개월 목표 | 증거 |
|------|------|-------------|------|
| A 데이터 | 세션맵·미니RAG | 팀 코퍼스+감사 리텐션 | 이탈 시 “감사 공백” 리스크 문서화 |
| B 정책 | 로컬 3계정·directory | SSO+RBAC+모델 allowlist | 보안 승인 체크리스트 통과 |
| C 운영 | dev:all 스크립트 | 설치 패키지+백업+헬스 | IT 런북 1세트 |
| D 템플릿 | AGENTS.md 시드 | 2+ 스택 템플릿 | 온보딩 < 1일 |
| E 유통 | 데모 | Pilot SoW 2건+ | 유료 파일럿 |

---

## 4. 독립 영역 (Category of One)

### 4.1 카테고리 정의

**CodeHarbor = 사내망에서 동작하는, 멀티유저 바이브코딩 컨트롤 플레인**

```
[ IdP / SSO ]
      │
[ CodeHarbor Gateway ]  ← 우리가 소유하는 핵심
  ├─ Auth / RBAC / Quota / Audit
  ├─ Workspace provision + Sandbox
  ├─ Model key vault (BFF)
  ├─ RAG / Steering
  └─ Agent runtime adapter (OpenCode 등 교체 가능)
      │
[ IDE Shell: OpenChamber / legacy chat ]
[ Git / CI / Internal docs ]
```

### 4.2 경계 (Boundary rules)

| In scope | Out of scope (의도적) |
|----------|------------------------|
| 유저·프로젝트 격리 | 최고의 탭 자동완성 |
| 세션 소유권·프록시 강제 | 모델 학습/파인튜닝 플랫폼 |
| 감사·쿼터·비용 | 범용 RPA / 고객센터 에이전트 |
| 온프렘 배포 | 퍼블릭 멀티테넌트 소비자 SaaS 1.0 |
| 에이전트 실행 정책 | 모든 언어의 최고 IDE |

### 4.3 ICP (이상 고객)

- **1차:** 50–500명 IT, 규제·보안 리뷰 있는 기업 개발 조직  
- **구매자:** 개발 리더 + 정보보안/IT 운영 (듀얼 셀)  
- **고통:**  
  - 개인 AI 툴 난립, 키·코드 유출 우려  
  - 바이브코딩은 쓰고 싶으나 감사 추적이 없음  
  - 외주/인턴에게 에이전트 권한을 줄 수 없음  

---

## 5. 로드맵 (해자 우선 정렬)

### Phase P0 — Foundation (완료~유지)

- 멀티유저 인증, workspace 격리, OpenCode BFF, Chamber, RAG 미니, quota/audit 골격, CodeHarbor 브랜드  
- **해자 기여:** A·B 시드

### Phase P1 — Pilot-Ready Governance (90일, 셀링 가능 최소)

**목표:** 보안이 거절하지 않는 파일럿 패키지

| Epic | 스펙 요약 | 해자 |
|------|-----------|------|
| P1.1 SSO (OIDC) | 로그인 OIDC, 로컬 계정 폴백, 그룹→role 매핑 | B |
| P1.2 Admin Console | 유저, API 키(중앙), 쿼터, 감사 로그 조회 UI | B, E |
| P1.3 Project workspaces | user-home 외 `projects/{id}` + 멤버 ACL | A, B |
| P1.4 Sandbox v1 | Docker(or process jail) per workspace, 네트워크 정책 토글 | B, C |
| P1.5 Audit export | 기간·유저 필터, CSV/JSON 다운로드 | A, E |
| P1.6 Cost meter | 모델 호출 횟수/토큰 추정, 유저·프로젝트 집계 | E |
| P1.7 Security pack | 데이터 흐름도, 위협 모델 1페이지, 파일럿 SoW | C, E |

**Exit criteria**

- [ ] SSO로 파일럿 팀 로그인  
- [ ] 관리자 키만으로 에이전트 동작 (개인 키 불필요)  
- [ ] 유저 A가 B 워크스페이스 파일/세션 접근 403  
- [ ] 감사 로그에서 “누가 어떤 세션에 메시지 보냄” 재현  
- [ ] 15분 데모 스크립트 표준화  

### Phase P2 — Team Standard (파일럿 후 3–6개월)

| Epic | 요약 | 해자 |
|------|------|------|
| P2.1 RBAC | Admin / Lead / Dev / Guest + 프로젝트 역할 | B |
| P2.2 Steering UI | org/team/repo 규칙, AGENTS.md 배포 | A, D |
| P2.3 RAG corp | 위키/스펙 연동, 출처 점프, 재인덱싱 잡 | A |
| P2.4 Git enterprise | GitHub/GitLab app, 브랜치 보호와 맞춤 | D, E |
| P2.5 Spec lite | requirements→tasks 체크리스트 + 세션 바인딩 + test gate | 차별 UX (Kiro 방향, 얇게) |
| P2.6 Templates | 2개 스택 원클릭 워크스페이스 | D |
| P2.7 Installer | compose/helm, 백업·복구 런북 | C |

**Exit criteria**

- [ ] 본부 표준 도구로 채택 의사 1건  
- [ ] 팀 단위 비용 리포트 월간 발행  
- [ ] 온보딩 신입 1일 내 첫 에이전트 PR  

### Phase P3 — Platform / Moat Lock (6–12개월)

| Epic | 요약 | 해자 |
|------|------|------|
| P3.1 Air-gap option | 오프라인 모델 라우트 또는 프라이빗 엔드포인트 only | C, E |
| P3.2 Eval harness | 골든 태스크 회귀, 팀별 품질 | A |
| P3.3 Hooks | commit/PR/이슈 웹훅 → 에이전트 | D |
| P3.4 Skill marketplace (internal) | 사내 스킬/MCP 카탈로그 | D |
| P3.5 Multi-agent | implement / review 분리 (옵션) | — |
| P3.6 Compliance export | 감사 리포트, 보존 정책 | E |

---

## 6. 코어 스펙 골격 (P1 중심)

### 6.1 시스템 컨텍스트

```
Browser ──► CodeHarbor Gateway (:3000)
               │  session cookie / OIDC
               ├─► Postgres (sessions, audit, rag, quota, cost)
               ├─► Workspace FS or volume (per user/project)
               ├─► Sandbox runtime (docker)
               ├─► OpenCode adapter (:4096)
               └─► Model providers (keys server-side only)
OpenChamber ──► Gateway /chamber + API base
```

### 6.2 도메인 객체

| Entity | 설명 |
|--------|------|
| User | IdP sub 또는 로컬 계정, role |
| Organization | 단일 테넌트(온프렘 기본 1) |
| Project | 공유 워크스페이스, 멤버, 정책 |
| Workspace | 실행 루트 경로, sandbox id |
| AgentSession | OpenCode session id ↔ owner ↔ workspace |
| AuditEvent | actor, action, resource, ts, meta |
| ApiCredential | 암호화된 provider key (admin only read-once) |
| UsageRecord | tokens/calls per user/project/day |
| SteeringDoc | 규칙 문서 버전 |
| Spec/Task (P2) | 선택적 작업 단위 |

### 6.3 비기능 요구 (NFR)

| ID | 요구 |
|----|------|
| NFR-1 | 모델 API 키는 브라우저·클라이언트 번들에 존재하지 않는다 |
| NFR-2 | 크로스 유저 workspace path 접근은 403 |
| NFR-3 | 크로스 유저 agent session 접근은 403 (OpenCode down이어도 소유권 우선) |
| NFR-4 | 감사 로그는 관리자 조회 가능, 일반 유저 변조 불가 |
| NFR-5 | 파일럿 규모: 동시 25 유저, 워크스페이스 50 |
| NFR-6 | 게이트웨이 재시작 후 웹 세션(PG) 유지 |
| NFR-7 | 업스트림 IDE 교체 가능 (adapter 경계 유지) |

### 6.4 P1 API 스케치 (추가분)

```
POST   /api/auth/oidc/login
GET    /api/auth/oidc/callback
GET    /api/admin/users
PATCH  /api/admin/users/:id
GET    /api/admin/audit?from&to&user
GET    /api/admin/usage?from&to
PUT    /api/admin/credentials/:provider
POST   /api/projects
GET    /api/projects
POST   /api/projects/:id/members
POST   /api/projects/:id/bind     # workspace + session
GET    /api/projects/:id/audit
```

### 6.5 보안 불변식 (반드시 테스트)

1. user2 → user1 session id → 403  
2. user2 → user1 project path traversal → 403  
3. 비로그인 `/opencode/*` → 401  
4. 폐기된 유저 → 즉시 세션 무효  
5. credential API → admin only  

### 6.6 어댑터 경계 (해자 보호)

```
apps/server/src/runtime/
  types.ts          # Session, Prompt, Diff 추상
  opencode/         # 현재 구현
  (future) other/
```

업스트림 변경이 잦아도 **정책·테넌시·감사**는 `runtime` 밖에 둔다.

---

## 7. 가격·패키지 (해자 E와 정렬)

| Tier | 포함 | 해자 잠금 |
|------|------|-----------|
| **Pilot** | N seats, SSO, audit, sandbox, central keys, 8주 지원 | 운영 습관 |
| **Team** | RBAC, cost, RAG corp, templates, Git app | 데이터+정책 |
| **Enterprise** | Air-gap, SLA, retention, skill catalog | 컴플라이언스 |

가격 축 권장: **Seat / month + 토큰 패스스루(투명)**  
→ “마진을 모델에 숨기지 않음”이 보안·재무 신뢰.

---

## 8. KPI (제품이 해자를 쌓는지 측정)

| KPI | Pilot | Team |
|-----|-------|------|
| WAU / seat | ≥ 40% | ≥ 50% |
| 에이전트 세션 / WAU / week | ≥ 3 | ≥ 5 |
| 감사 이벤트 보존 | 90일 | 1년+ |
| 개인 AI 툴 병행율 (설문) | 감소 | 50%↓ |
| 보안 예외 신청 건수 | 감소 | — |
| NPS / “표준으로 쓸까” | ≥ 7 | 채택 결정 |

---

## 9. 리스크 레지스터

| 리스크 | 완화 |
|--------|------|
| OpenChamber 서브패스 취약 | base-path 업스트림 기여 또는 direct port 옵션 유지 |
| 샌드박스 없는 에이전트 사고 | P1.4 전 파일럿은 제한 네트워크·읽기 강조 계약 |
| 이름 CodeHarbor vs openHPI | 카테고리 문구·도메인으로 차별 |
| 기능 폭주 (IDE 경쟁) | 이 문서 boundary로 PR 거절 |
| 단일 고객 과맞춤 | ICP 체크리스트, P1 exit 고정 |

---

## 10. 90일 실행 백로그 (우선순위)

1. **P1.2 Admin + credential vault** (데모·보안 임팩트 최대)  
2. **P1.1 SSO OIDC**  
3. **P1.3 Project + ACL** (user 홈만으로는 팀 셀링 약함)  
4. **P1.5 Audit UI/export**  
5. **P1.6 Usage meter**  
6. **P1.4 Sandbox v1**  
7. **P1.7 Security pack + demo script**  

병렬: Playwright로 격리·자동 오픈 E2E 고정.

---

## 11. 다음 문서 (파생 스펙)

| 문서 | 내용 |
|------|------|
| `...-p1-admin-sso.md` | OIDC 플로우, 스키마, UI wire |
| `...-p1-project-sandbox.md` | Project ACL, docker 런타임 |
| `...-p1-audit-usage.md` | 이벤트 카탈로그, 비용 산식 |
| `...-security-onepager.md` | 고객 제출용 |

---

## 12. 결정 로그

| 날짜 | 결정 |
|------|------|
| 2026-07-19 | 제품명 **CodeHarbor** |
| 2026-07-19 | 카테고리 **Governed Vibe Coding Platform** |
| 2026-07-19 | 해자 우선순위: 테넌시·정책·감사·온프렘 > IDE 기능 경쟁 |
| 2026-07-19 | 런타임 어댑터 패턴으로 OpenCode 교체 가능성 유지 |

---

*이 문서는 구현 PR의 가드레일이다. Boundary 밖 기능은 “좋아 보여도” P2 이전 기본 거절.*
