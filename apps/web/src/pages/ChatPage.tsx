import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuthStore } from "../stores/authStore";
import { useChatStore } from "../stores/chatStore";
import { api } from "../api/client";
import { SessionList } from "../components/SessionList";
import { MessageStream } from "../components/MessageStream";
import { Composer } from "../components/Composer";
import { FileTree } from "../components/FileTree";
import { RagPanel } from "../components/RagPanel";
import { StatusBar } from "../components/StatusBar";
import { PermissionCard } from "../components/PermissionCard";
import { ResizeHandle } from "../components/ResizeHandle";
import { usePanelWidths } from "../hooks/usePanelWidths";

export function ChatPage() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const health = useChatStore((s) => s.health);
  const refreshHealth = useChatStore((s) => s.refreshHealth);
  const loadSessions = useChatStore((s) => s.loadSessions);
  const loadFiles = useChatStore((s) => s.loadFiles);
  const connectEvents = useChatStore((s) => s.connectEvents);
  const disconnectEvents = useChatStore((s) => s.disconnectEvents);
  const [workspacePath, setWorkspacePath] = useState<string>("");
  const { widths, setPanel, adjustPanel, reset } = usePanelWidths();

  useEffect(() => {
    void refreshHealth();
    void loadSessions();
    void loadFiles();
    connectEvents();
    void api
      .workspace()
      .then((w) => setWorkspacePath(w.path))
      .catch(() => setWorkspacePath(""));
    const t = setInterval(() => void refreshHealth(), 10000);
    return () => {
      clearInterval(t);
      disconnectEvents();
    };
  }, [
    refreshHealth,
    loadSessions,
    loadFiles,
    connectEvents,
    disconnectEvents,
  ]);

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between border-b border-zinc-800 bg-zinc-900 px-4 py-2">
        <div className="flex min-w-0 items-center gap-3">
          <span className="shrink-0 font-semibold text-white">
            Vibecoding Builder
          </span>
          <span className="shrink-0 text-xs text-zinc-500">
            {user?.username} ({user?.role})
          </span>
          {workspacePath && (
            <span
              className="truncate text-[11px] text-zinc-600"
              title={workspacePath}
            >
              ws: {workspacePath}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 text-sm">
          <button
            type="button"
            onClick={reset}
            title="패널 너비 기본값으로 초기화"
            className="text-xs text-zinc-500 hover:text-zinc-300"
          >
            레이아웃 초기화
          </button>
          {user?.role === "admin" && (
            <Link to="/admin" className="text-indigo-400 hover:text-indigo-300">
              Admin
            </Link>
          )}
          <button
            type="button"
            onClick={() => void logout()}
            className="text-zinc-400 hover:text-zinc-200"
          >
            Logout
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 overflow-hidden">
        {/* Sessions */}
        <div
          className="min-h-0 shrink-0 overflow-hidden"
          style={{ width: widths.sessions }}
        >
          <SessionList />
        </div>

        <ResizeHandle
          onResize={(dx) => adjustPanel("sessions", dx)}
          onDoubleClick={() => setPanel("sessions", 200)}
          title="세션 패널 너비 · 드래그 조절 · 더블클릭 기본값"
        />

        {/* Chat (fills remaining space) */}
        <div className="flex min-h-0 min-w-[240px] flex-1 flex-col overflow-hidden">
          <div className="min-h-0 flex-1">
            <MessageStream />
          </div>
          <Composer />
        </div>

        <ResizeHandle
          onResize={(dx) => adjustPanel("files", -dx)}
          onDoubleClick={() => setPanel("files", 220)}
          title="파일 패널 너비 · 드래그 조절 · 더블클릭 기본값"
        />

        {/* Files */}
        <div
          className="min-h-0 shrink-0 overflow-hidden"
          style={{ width: widths.files }}
        >
          <FileTree />
        </div>

        <ResizeHandle
          onResize={(dx) => adjustPanel("rag", -dx)}
          onDoubleClick={() => setPanel("rag", 240)}
          title="RAG 패널 너비 · 드래그 조절 · 더블클릭 기본값"
        />

        {/* RAG */}
        <div
          className="min-h-0 shrink-0 overflow-hidden"
          style={{ width: widths.rag }}
        >
          <RagPanel />
        </div>
      </div>

      <StatusBar health={health} />
      <PermissionCard />
    </div>
  );
}
