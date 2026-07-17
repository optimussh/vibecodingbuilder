import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useChatStore } from "../stores/chatStore";

function parseMessage(m: unknown): { role: string; text: string } {
  if (!m || typeof m !== "object") return { role: "system", text: String(m) };
  const o = m as Record<string, unknown>;

  if (o.info && typeof o.info === "object") {
    const info = o.info as Record<string, unknown>;
    const role = String(info.role ?? info.type ?? "assistant");
    const parts = (o.parts as unknown[]) ?? [];
    const text = parts
      .map((p) =>
        p && typeof p === "object" && "text" in p
          ? String((p as { text: unknown }).text)
          : p && typeof p === "object" && (p as { type?: string }).type === "tool"
            ? `\`${String((p as { tool?: string }).tool ?? "tool")}\``
            : "",
      )
      .filter(Boolean)
      .join("\n\n");
    return { role, text: text || JSON.stringify(o).slice(0, 400) };
  }

  if (Array.isArray(o.parts)) {
    const text = o.parts
      .map((p) => {
        if (p && typeof p === "object" && "text" in p) {
          return String((p as { text: unknown }).text);
        }
        return "";
      })
      .filter(Boolean)
      .join("\n\n");
    return { role: "assistant", text };
  }

  return { role: "system", text: JSON.stringify(o).slice(0, 400) };
}

export function MessageStream() {
  const messages = useChatStore((s) => s.messages);
  const streamLog = useChatStore((s) => s.streamLog);
  const error = useChatStore((s) => s.error);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {error && (
          <div className="rounded border border-red-800 bg-red-950/50 px-3 py-2 text-sm text-red-300">
            {error}
          </div>
        )}
        {messages.map((m, i) => {
          const { role, text } = parseMessage(m);
          const isUser = role === "user";
          return (
            <div
              key={i}
              className={`rounded-lg border px-3 py-2 text-sm ${
                isUser
                  ? "border-indigo-900/50 bg-indigo-950/30 text-zinc-100"
                  : "border-zinc-800 bg-zinc-900/60 text-zinc-200"
              }`}
            >
              <div className="mb-1 text-[10px] uppercase tracking-wide text-zinc-500">
                {role}
              </div>
              <div className="prose prose-invert prose-sm max-w-none prose-pre:bg-zinc-950 prose-pre:text-xs prose-code:text-indigo-300">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
              </div>
            </div>
          );
        })}
        {messages.length === 0 && (
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-4 text-sm text-zinc-400">
            <p className="font-medium text-zinc-200">채팅 준비됨</p>
            <p className="mt-2">
              왼쪽 <strong className="text-indigo-300">+ New</strong> 로 세션을 만들거나,
              자동 생성된 세션에 메시지를 보내세요.
            </p>
            <p className="mt-2 text-xs text-zinc-600">
              예: <code className="text-zinc-400">hello.txt 만들어줘</code>
            </p>
          </div>
        )}
      </div>
      <div className="max-h-28 overflow-y-auto border-t border-zinc-800 bg-zinc-950 px-3 py-2 font-mono text-[10px] text-zinc-500">
        {streamLog.slice(-30).map((l, i) => (
          <div key={i}>{l}</div>
        ))}
      </div>
    </div>
  );
}
