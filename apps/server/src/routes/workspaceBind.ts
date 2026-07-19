import { Router } from "express";
import { requireAuth } from "../auth/requireAuth.js";
import { bootstrapUserWorkspace } from "../workspaceBootstrap.js";
import { config } from "../config.js";
import { opencodeFetch, parseJsonBody, sessionIdOf } from "../opencode/http.js";
import { checkOpencodeHealth } from "../opencode/client.js";
import * as sessionMap from "../sessionMap.js";
import { appendAudit } from "../audit.js";
import { buildChamberOpenPath, buildChamberOpenUrl } from "../chamberUrl.js";

export const workspaceBindRouter = Router();

/** Ensure workspace markers + return paths for Chamber/OpenCode */
workspaceBindRouter.post("/workspace/bind", requireAuth, async (req, res) => {
  const username = req.session.user!.username;
  const workspace = bootstrapUserWorkspace(username);

  let session: unknown = null;
  let sessionId: string | undefined;

  // Reuse latest claimed session for this user when present
  const existing = sessionMap
    .listRecordsByUser(username)
    .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")))[0];
  if (existing?.id) {
    sessionId = existing.id;
  }

  if (!sessionId && (await checkOpencodeHealth()) === "up") {
    try {
      const created = await opencodeFetch("/session", {
        method: "POST",
        directory: workspace,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: `${username}-workspace-${Date.now()}`,
        }),
      });
      if (created.ok) {
        session = await parseJsonBody(created);
        sessionId = sessionIdOf(session);
        if (sessionId) {
          sessionMap.claim(sessionId, username, workspace);
        }
      }
    } catch (err) {
      console.warn("[workspace/bind] session create failed:", err);
    }
  }

  appendAudit("workspace.bind", username, { workspace, sessionId });

  const chamberDirect = (config.openchamberUrl || "http://127.0.0.1:3001").replace(
    /\/$/,
    "",
  );
  const chamberUrl = buildChamberOpenUrl({
    workspace,
    sessionId,
    viaGateway: true,
  });
  const chamberPath = buildChamberOpenPath({ workspace, sessionId });
  const chamberDirectUrl = buildChamberOpenUrl({
    workspace,
    sessionId,
    viaGateway: false,
  });

  res.json({
    username,
    workspace,
    sessionId: sessionId ?? null,
    session,
    /** Preferred: platform gateway subpath with auto-open query params */
    chamberUrl,
    chamberPath,
    /** Direct OpenChamber origin (bypass gateway) with same params */
    chamberDirectUrl,
    chamberBase: chamberDirect,
    openInstructions: `Auto-open URL:\n${chamberUrl}\n\nIf the project did not open, use Open folder:\n${workspace}`,
    legacyChatUrl: "http://127.0.0.1:5173/",
  });
});

workspaceBindRouter.get("/workspace/bind", requireAuth, (req, res) => {
  const username = req.session.user!.username;
  const workspace = bootstrapUserWorkspace(username);
  const sessions = sessionMap.listRecordsByUser(username);
  const latest = sessions.sort((a, b) =>
    String(b.createdAt || "").localeCompare(String(a.createdAt || "")),
  )[0];
  res.json({
    username,
    workspace,
    chamberUrl: buildChamberOpenUrl({
      workspace,
      sessionId: latest?.id,
      viaGateway: true,
    }),
    chamberPath: buildChamberOpenPath({
      workspace,
      sessionId: latest?.id,
    }),
    sessions,
  });
});
