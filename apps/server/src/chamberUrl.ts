import { config } from "./config.js";

export type ChamberOpenParams = {
  workspace: string;
  sessionId?: string | null;
  /** Prefer platform subpath /chamber/ over direct OPENCHAMBER_URL */
  viaGateway?: boolean;
};

/**
 * Build OpenChamber open URL with directory (+ optional sessionId).
 * OpenChamber App.tsx / events accept these query params; our HTML inject
 * also bootstraps open-session / open-draft-session on app-ready.
 */
export function buildChamberOpenUrl(params: ChamberOpenParams): string {
  const viaGateway = params.viaGateway !== false;
  const base = viaGateway
    ? `http://127.0.0.1:${config.port}/chamber/`
    : (config.openchamberUrl || "http://127.0.0.1:3001").replace(/\/$/, "") +
      "/";

  const u = new URL(base);
  if (params.workspace) {
    u.searchParams.set("directory", params.workspace);
  }
  if (params.sessionId) {
    u.searchParams.set("sessionId", params.sessionId);
  }
  return u.toString();
}

/** Relative path for same-origin redirects (keeps session cookie). */
export function buildChamberOpenPath(params: {
  workspace: string;
  sessionId?: string | null;
}): string {
  const qs = new URLSearchParams();
  if (params.workspace) qs.set("directory", params.workspace);
  if (params.sessionId) qs.set("sessionId", params.sessionId);
  const q = qs.toString();
  return q ? `/chamber/?${q}` : "/chamber/";
}

/**
 * Bootstrap snippet injected into Chamber HTML so the SPA opens the
 * platform workspace without manual "Open folder".
 */
export function chamberAutoOpenBootstrapScript(): string {
  return `(() => {
  try {
    const params = new URLSearchParams(location.search);
    const directory = (params.get("directory") || "").trim();
    const sessionId = (params.get("sessionId") || "").trim();
    if (!directory && !sessionId) return;
    const vibe = window.__VIBE_PLATFORM__ || {};
    if (directory) vibe.directory = directory;
    if (sessionId) vibe.sessionId = sessionId;
    window.__VIBE_PLATFORM__ = vibe;

    let applied = false;
    const apply = () => {
      if (applied) return;
      applied = true;
      try {
        if (sessionId) {
          window.dispatchEvent(new CustomEvent("openchamber:open-session", {
            detail: { sessionId, directory: directory || undefined }
          }));
        } else if (directory) {
          window.dispatchEvent(new CustomEvent("openchamber:open-draft-session", {
            detail: { directory }
          }));
        }
      } catch (e) { console.warn("[vibe] auto-open failed", e); }
    };

    if (window.__openchamberAppReady) apply();
    window.addEventListener("openchamber:app-ready", apply, { once: true });
    let n = 0;
    const t = setInterval(() => {
      n += 1;
      if (window.__openchamberAppReady) { apply(); clearInterval(t); }
      else if (n >= 60) { apply(); clearInterval(t); }
    }, 250);
  } catch (e) { console.warn("[vibe] auto-open bootstrap error", e); }
})();`;
}
