export type Role = "admin" | "user";

export interface AuthUser {
  username: string;
  role: Role;
}

export interface HealthStatus {
  server: "ok";
  opencode: "up" | "down";
  llm: "configured" | "missing";
  rag?: "up" | "down" | "disabled";
}

export interface RagDocument {
  id: string;
  filename: string;
  mime?: string | null;
  byte_size: number;
  chunk_count?: number;
  created_at?: string;
}

export interface RagHit {
  chunkId: string;
  documentId: string;
  filename: string;
  content: string;
  score: number;
  chunkIndex: number;
}

export interface FileNode {
  name: string;
  path: string;
  type: "file" | "directory";
  children?: FileNode[];
}

async function request<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(path, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    ...init,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      (data as { error?: string }).error ?? `HTTP ${res.status}`,
    );
  }
  return data as T;
}

export const api = {
  login(username: string, password: string) {
    return request<AuthUser>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    });
  },
  logout() {
    return request<{ ok: boolean }>("/api/auth/logout", { method: "POST" });
  },
  me() {
    return request<AuthUser>("/api/auth/me");
  },
  health() {
    return request<HealthStatus>("/api/health");
  },
  sessions() {
    return request<unknown[]>("/api/sessions");
  },
  createSession(title?: string) {
    return request<Record<string, unknown>>("/api/sessions", {
      method: "POST",
      body: JSON.stringify({ title }),
    });
  },
  deleteSession(id: string) {
    return request<{ ok: boolean }>(`/api/sessions/${id}`, {
      method: "DELETE",
    });
  },
  renameSession(id: string, title: string) {
    return request<Record<string, unknown>>(`/api/sessions/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ title }),
    });
  },
  messages(id: string) {
    return request<unknown[]>(`/api/sessions/${id}/messages`);
  },
  sendMessage(id: string, text: string) {
    return request<unknown>(`/api/sessions/${id}/messages`, {
      method: "POST",
      body: JSON.stringify({ text }),
    });
  },
  abort(id: string) {
    return request<{ ok: boolean }>(`/api/sessions/${id}/abort`, {
      method: "POST",
    });
  },
  respondPermission(
    sessionId: string,
    permissionId: string,
    response: "once" | "always" | "reject",
  ) {
    return request<{ ok: boolean }>(
      `/api/sessions/${sessionId}/permissions/${permissionId}`,
      {
        method: "POST",
        body: JSON.stringify({ response }),
      },
    );
  },
  fsTree(projectId?: string | null) {
    const q = projectId
      ? `?projectId=${encodeURIComponent(projectId)}`
      : "";
    return request<{
      root: string;
      tree: FileNode[];
      kind?: string;
      projectId?: string | null;
      path?: string;
    }>(`/api/fs${q}`);
  },
  fsContent(path: string, projectId?: string | null) {
    const q = new URLSearchParams({ path });
    if (projectId) q.set("projectId", projectId);
    return request<{ path: string; content: string }>(
      `/api/fs/content?${q}`,
    );
  },
  adminUsers() {
    return request<{ users: AuthUser[] }>("/api/admin/users");
  },
  adminAudit(limit = 100) {
    return request<{ events: Array<Record<string, unknown>> }>(
      `/api/admin/audit?limit=${limit}`,
    );
  },
  workspace() {
    return request<{
      username: string;
      path: string;
      sessionCount: number;
    }>("/api/workspace");
  },
  adminWorkspaces() {
    return request<{
      workspaces: Array<{
        username: string;
        role: Role;
        path: string;
        fileCount: number;
        bytes: number;
        sessions: number;
      }>;
    }>("/api/admin/workspaces");
  },
  ragStatus() {
    return request<{
      rag: "up" | "down" | "disabled";
      embedding: { mode: string; model: string };
    }>("/api/rag/status");
  },
  ragDocuments() {
    return request<{ documents: RagDocument[] }>("/api/rag/documents");
  },
  async ragUpload(file: File) {
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/rag/documents", {
      method: "POST",
      credentials: "include",
      body: fd,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(
        (data as { error?: string }).error ?? `HTTP ${res.status}`,
      );
    }
    return data as {
      documentId: string;
      chunks: number;
      embedProvider: string;
    };
  },
  ragDelete(id: string) {
    return request<{ ok: boolean }>(`/api/rag/documents/${id}`, {
      method: "DELETE",
    });
  },
  ragSearch(query: string, topK = 5) {
    return request<{ hits: RagHit[] }>("/api/rag/search", {
      method: "POST",
      body: JSON.stringify({ query, topK }),
    });
  },
  workspaceBind() {
    return request<{
      username: string;
      workspace: string;
      sessionId: string | null;
      chamberUrl: string;
      chamberPath?: string;
      chamberDirectUrl?: string;
      openInstructions: string;
    }>("/api/workspace/bind", {
      method: "POST",
      body: JSON.stringify({}),
    });
  },
  previewStart() {
    return request<{
      running: boolean;
      port: number;
      url: string;
      direct: string;
    }>("/api/preview/start", {
      method: "POST",
      body: JSON.stringify({}),
    });
  },
  previewStop() {
    return request<{ ok: boolean }>("/api/preview/stop", { method: "POST" });
  },
  previewStatus() {
    return request<{
      running: boolean;
      port?: number;
      url?: string;
      direct?: string;
    }>("/api/preview");
  },
  gitStatus() {
    return request<{
      isRepo: boolean;
      cwd?: string;
      branch?: string | null;
      modified?: string[];
      staged?: string[];
      not_added?: string[];
      message?: string;
    }>("/api/git/status");
  },
  gitInit() {
    return request<{ ok: boolean; cwd: string }>("/api/git/init", {
      method: "POST",
      body: JSON.stringify({}),
    });
  },
  gitDiff(staged = false) {
    return request<{ isRepo: boolean; diff: string }>(
      `/api/git/diff${staged ? "?staged=1" : ""}`,
    );
  },
  sessionDiff(id: string) {
    return request<unknown>(`/api/sessions/${id}/diff`);
  },
  async workspaceUpload(file: File, dir = ".", projectId?: string | null) {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("dir", dir);
    if (projectId) fd.append("projectId", projectId);
    const res = await fetch("/api/workspace/upload", {
      method: "POST",
      credentials: "include",
      body: fd,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(
        (data as { error?: string }).error ?? `HTTP ${res.status}`,
      );
    }
    return data as { ok: boolean; path: string; bytes: number };
  },
  projects() {
    return request<{
      projects: Array<{
        id: string;
        slug: string;
        name: string;
        myRole: string;
        rootPath: string;
      }>;
    }>("/api/projects");
  },
  createProject(name: string) {
    return request<Record<string, unknown>>("/api/projects", {
      method: "POST",
      body: JSON.stringify({ name }),
    });
  },
  projectBind(id: string) {
    return request<{
      projectId: string;
      workspace: string;
      sessionId: string | null;
      chamberPath: string;
      chamberUrl: string;
    }>(`/api/projects/${id}/bind`, {
      method: "POST",
      body: JSON.stringify({}),
    });
  },
  templates() {
    return request<{ templates: Array<{ id: string; name: string }> }>(
      "/api/templates",
    );
  },
  applyTemplate(id: string, projectId?: string | null) {
    return request<{ ok: boolean; workspace: string }>(
      `/api/templates/${id}/apply`,
      {
        method: "POST",
        body: JSON.stringify({ projectId: projectId ?? undefined }),
      },
    );
  },
  skills() {
    return request<{
      skills: Array<{ id: string; name: string; description: string }>;
    }>("/api/skills");
  },
  applySkill(id: string, projectId?: string | null) {
    return request<{ ok: boolean }>(`/api/skills/${id}/apply`, {
      method: "POST",
      body: JSON.stringify({ projectId: projectId ?? undefined }),
    });
  },
  specs() {
    return request<{
      specs: Array<{
        id: string;
        title: string;
        requirements: string;
        design: string;
        tasks: Array<{ id: string; title: string; done: boolean }>;
      }>;
    }>("/api/specs");
  },
  createSpec(title: string, projectId?: string | null) {
    return request<Record<string, unknown>>("/api/specs", {
      method: "POST",
      body: JSON.stringify({ title, projectId: projectId ?? undefined }),
    });
  },
  patchSpec(
    id: string,
    body: {
      title?: string;
      requirements?: string;
      design?: string;
      tasks?: Array<{ id: string; title: string; done: boolean }>;
    },
  ) {
    return request<Record<string, unknown>>(`/api/specs/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    });
  },
  usageMe() {
    return request<{
      rows: Array<{
        username: string;
        messages: number;
        estCostUsd: number;
      }>;
      totalEstCostUsd: number;
    }>("/api/usage/me");
  },
  sandboxStatus(projectId?: string | null) {
    const q = projectId
      ? `?projectId=${encodeURIComponent(projectId)}`
      : "";
    return request<Record<string, unknown>>(`/api/sandbox/status${q}`);
  },
  sandboxStart(projectId?: string | null) {
    return request<Record<string, unknown>>("/api/sandbox/start", {
      method: "POST",
      body: JSON.stringify({ projectId: projectId ?? undefined }),
    });
  },
};
