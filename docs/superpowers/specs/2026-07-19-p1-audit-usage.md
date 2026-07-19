# P1.5 / P1.6 — Audit Export + Usage / Cost Meter

**Product:** CodeHarbor  
**Parent:** [2026-07-19-codeharbor-moat-roadmap.md](./2026-07-19-codeharbor-moat-roadmap.md)  
**Status:** Ready for implementation  
**Depends on:** audit pipeline (exists), admin role ([p1-admin-sso](./2026-07-19-p1-admin-sso.md))  
**Moat:** A (감사 데이터), E (비용 가시성·보안 설득)

---

## 1. Goals

| ID | Goal |
|----|------|
| G1 | 관리자가 기간·유저·액션으로 **감사 로그 조회/export** |
| G2 | 메시지/모델 호출 단위 **사용량 집계** (유저·프로젝트·일) |
| G3 | 토큰·비용 **추정** 리포트 (정확 과금이 아닌 가시성) |
| G4 | 파일럿 고객이 보안 리뷰에 제출 가능한 CSV/JSON |

### Non-goals (P1)

- 실시간 SIEM 연동 (webhook은 P2)  
- 프로바이더 공식 billing API 정산  
- 유저 self-serve 상세 비용 (admin + own summary만)

---

## 2. Current state

| 있음 | 없음 |
|------|------|
| `appendAudit(event, user, meta)` | Admin 조회 UI |
| 파일 `data/audit/` + PG `audit_events` 이중화 | 필터/export API |
| `quota` 일일 메시지 카운트 | 토큰/비용 시계열 |
| pino HTTP logs | usage_records 테이블 |

---

## 3. Event catalog (normative)

| action | when | meta (min) |
|--------|------|------------|
| `auth.login` | local/oidc success | method |
| `auth.logout` | logout | |
| `auth.login_failed` | bad password | reason |
| `workspace.bind` | bind | workspace, sessionId, projectId? |
| `session.create` | OC session | sessionId |
| `session.delete` | delete | sessionId |
| `session.rename` | patch title | sessionId, title |
| `message.send` | prompt accepted | sessionId, projectId?, ragHits? |
| `message.quota_denied` | 429 | |
| `rag.inject` | context injected | hitCount |
| `rag.upload` / `rag.delete` | doc ops | documentId |
| `proxy.forbidden` | cross-tenant | sessionId |
| `proxy.session.claim` | claim | sessionId |
| `chamber.access` | SPA shell | path |
| `git.init` / related | git ops | |
| `upload.file` | workspace upload | path |
| `preview.start` / `stop` | preview | port |
| `admin.credential.put` | key update | provider, last4 |
| `admin.user.patch` | role/quota | targetUser |
| `sandbox.start` / `stop` | sandbox | projectId? |
| `usage.meter` | internal rollup | (optional) |

**Retention (P1 default):** 90 days online; export before purge.

---

## 4. Data model

### Existing audit (normalize if needed)

```sql
-- Prefer single PG table; file remains fallback
CREATE TABLE IF NOT EXISTS audit_events (
  id          BIGSERIAL PRIMARY KEY,
  ts          TIMESTAMPTZ NOT NULL DEFAULT now(),
  action      TEXT NOT NULL,
  username    TEXT,
  meta        JSONB NOT NULL DEFAULT '{}',
  request_id  TEXT
);
CREATE INDEX IF NOT EXISTS audit_events_ts_idx ON audit_events (ts DESC);
CREATE INDEX IF NOT EXISTS audit_events_user_idx ON audit_events (username, ts DESC);
CREATE INDEX IF NOT EXISTS audit_events_action_idx ON audit_events (action, ts DESC);
```

### Usage

```sql
CREATE TABLE IF NOT EXISTS usage_records (
  id            BIGSERIAL PRIMARY KEY,
  ts            TIMESTAMPTZ NOT NULL DEFAULT now(),
  username      TEXT NOT NULL,
  project_id    UUID,
  session_id    TEXT,
  kind          TEXT NOT NULL,  -- 'message' | 'embed' | 'completion'
  model         TEXT,
  input_tokens  INT,
  output_tokens INT,
  est_cost_usd  NUMERIC(12, 6),
  meta          JSONB NOT NULL DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS usage_records_day_user
  ON usage_records (username, ((ts AT TIME ZONE 'UTC')::date));
```

### Pricing table (config, not secret)

```env
# rough estimates for visibility — not invoices
COST_INPUT_PER_1M_USD=0.10
COST_OUTPUT_PER_1M_USD=0.40
COST_EMBED_PER_1M_USD=0.01
```

OpenCode가 토큰을 안 주면:

- `input_tokens ≈ ceil(chars/4)` 추정  
- `output_tokens` unknown → null, cost partial  

---

## 5. API

### Audit (admin)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/admin/audit` | query: `from`, `to`, `user`, `action`, `limit`, `cursor` |
| GET | `/api/admin/audit/export` | `format=csv\|json` + same filters; stream download |

Response item:

```json
{
  "id": "123",
  "ts": "2026-07-19T02:00:00.000Z",
  "action": "message.send",
  "username": "user1",
  "meta": { "sessionId": "ses_..." },
  "requestId": "req_..."
}
```

### Usage

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/admin/usage` | admin | aggregate: by user/day/project |
| GET | `/api/admin/usage/export` | admin | csv/json |
| GET | `/api/usage/me` | user | my summary (7/30d) |

Aggregate query params: `from`, `to`, `groupBy=user|day|project|model`.

Example:

```json
{
  "from": "...",
  "to": "...",
  "rows": [
    {
      "username": "user1",
      "messages": 42,
      "inputTokens": 120000,
      "outputTokens": 80000,
      "estCostUsd": 0.12
    }
  ],
  "totalEstCostUsd": 1.05
}
```

---

## 6. Instrumentation points

| Call site | kind | notes |
|-----------|------|-------|
| `POST /api/sessions/:id/messages` | message | after accept (not 429) |
| RAG embed | embed | per batch |
| Future completion proxy | completion | if direct LLM |

Helper:

```ts
recordUsage({
  username,
  projectId,
  sessionId,
  kind: "message",
  model: config.opencodeModelId,
  inputTokens,
  outputTokens,
})
```

Cost:

```
est = in/1e6 * COST_INPUT + out/1e6 * COST_OUTPUT
```

---

## 7. UI

### Admin → Audit

- Date range picker  
- User / action filters  
- Table + “Export CSV”  
- Row expand → meta JSON  

### Admin → Usage

- KPI cards: messages, est. cost, active users  
- Bar/table by user  
- Export  

### User (optional P1)

- Status bar: “Today: 12 / 200 messages · est $0.03”

---

## 8. Export formats

**CSV columns (audit):**  
`ts,action,username,request_id,meta_json`

**CSV columns (usage):**  
`date,username,project_id,messages,input_tokens,output_tokens,est_cost_usd`

Filename: `codeharbor-audit-YYYYMMDD-YYYYMMDD.csv`

---

## 9. Acceptance tests

| # | Case | Expected |
|---|------|----------|
| T1 | message.send creates audit row | found in GET audit |
| T2 | non-admin audit API | 403 |
| T3 | export csv content-type + header row | ok |
| T4 | message increments usage_records | count +1 |
| T5 | usage aggregate sums match rows | ok |
| T6 | filter by user excludes others | ok |
| T7 | `/api/usage/me` only own data | ok |

---

## 10. Implementation plan (PRs)

1. **PR-A:** Normalize PG `audit_events` + admin list API  
2. **PR-B:** CSV/JSON export  
3. **PR-C:** `usage_records` + instrument message path  
4. **PR-D:** admin usage aggregate + me summary  
5. **PR-E:** Admin UI pages (can be minimal HTML)  

---

## 11. Privacy / security notes

- Export is **admin-only**; treat as sensitive (prompts may appear in meta — **do not store full prompt text in audit meta by default**)  
- `message.send` meta: sessionId, length, ragHits — **not** message body  
- Retention job (cron or on startup sweep) optional P1.5b  

---

## 12. Open questions

1. Store redacted prompt hash for forensics?  
2. Multi-currency? (P1: USD estimate only)  
3. Alert when team daily cost > threshold? (P2)
