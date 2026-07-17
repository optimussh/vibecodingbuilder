-- Phase 3 RAG + platform state (local)
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY,
  username TEXT NOT NULL,
  filename TEXT NOT NULL,
  mime TEXT,
  byte_size INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS documents_username_idx ON documents (username);

CREATE TABLE IF NOT EXISTS chunks (
  id UUID PRIMARY KEY,
  document_id UUID NOT NULL REFERENCES documents (id) ON DELETE CASCADE,
  username TEXT NOT NULL,
  chunk_index INTEGER NOT NULL,
  content TEXT NOT NULL,
  embedding vector(768),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS chunks_username_idx ON chunks (username);
CREATE INDEX IF NOT EXISTS chunks_document_id_idx ON chunks (document_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE indexname = 'chunks_embedding_hnsw_idx'
  ) THEN
    CREATE INDEX chunks_embedding_hnsw_idx
      ON chunks
      USING hnsw (embedding vector_cosine_ops);
  END IF;
EXCEPTION
  WHEN others THEN
    RAISE NOTICE 'hnsw index skipped: %', SQLERRM;
END $$;

-- Platform: agent session ownership
CREATE TABLE IF NOT EXISTS agent_sessions (
  session_id TEXT PRIMARY KEY,
  username TEXT NOT NULL,
  workspace TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS agent_sessions_username_idx ON agent_sessions (username);

-- Platform: audit log
CREATE TABLE IF NOT EXISTS audit_events (
  id BIGSERIAL PRIMARY KEY,
  ts TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  action TEXT NOT NULL,
  username TEXT,
  meta JSONB
);
CREATE INDEX IF NOT EXISTS audit_events_ts_idx ON audit_events (ts DESC);
CREATE INDEX IF NOT EXISTS audit_events_username_idx ON audit_events (username);
