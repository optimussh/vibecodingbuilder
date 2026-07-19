import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuthStore } from "../stores/authStore";

export function LoginPage() {
  const user = useAuthStore((s) => s.user);
  const login = useAuthStore((s) => s.login);
  const loading = useAuthStore((s) => s.loading);
  const error = useAuthStore((s) => s.error);
  const navigate = useNavigate();
  const [username, setUsername] = useState("user1");
  const [password, setPassword] = useState("user1");

  if (user) return <Navigate to="/" replace />;

  return (
    <div className="flex min-h-full items-center justify-center bg-zinc-950 p-6">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void (async () => {
            try {
              await login(username, password);
              navigate("/", { replace: true });
            } catch {
              // error already in store
            }
          })();
        }}
        className="w-full max-w-sm rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-xl"
      >
        <h1 className="text-xl font-semibold text-white">CodeHarbor</h1>
        <p className="mt-1 text-sm text-zinc-400">
          사내 바이브코딩 플랫폼 · 로그인 후 채팅으로 이동합니다
        </p>

        <label className="mt-6 block text-xs text-zinc-400">Username</label>
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
          autoComplete="username"
        />

        <label className="mt-3 block text-xs text-zinc-400">Password</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
          autoComplete="current-password"
        />

        {error && <p className="mt-3 text-sm text-red-400">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="mt-5 w-full rounded-lg bg-indigo-600 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
        >
          {loading ? "…" : "Login → 채팅"}
        </button>

        <p className="mt-4 text-[11px] leading-relaxed text-zinc-500">
          admin / admin123 · user1 / user1 · user2 / user2
          <br />
          이 화면은 <strong>레거시 채팅 UI</strong> (포트 5173) 입니다.
          OpenChamber IDE는{" "}
          <a
            className="text-indigo-400"
            href="http://127.0.0.1:3001"
            target="_blank"
            rel="noreferrer"
          >
            :3001
          </a>
          .
        </p>
      </form>
    </div>
  );
}
