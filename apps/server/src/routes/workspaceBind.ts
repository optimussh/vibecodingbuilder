import { Router } from "express";
import { requireAuth } from "../auth/requireAuth.js";
import { bootstrapUserWorkspace } from "../workspaceBootstrap.js";
import { config } from "../config.js";
import { opencodeFetch, parseJsonBody, sessionIdOf } from "../opencode/http.js";
import { checkOpencodeHealth } from "../opencode/client.js";
import * as sessionMap from "../sessionMap.js";
import { appendAudit } from "../audit.js";

export const workspaceBindRouter = Router();

/** Ensure workspace markers + return paths for Chamber/OpenCode */
workspaceBindRouter.post("/workspace/bind", requireAuth, async (req, res) => {
  const username = req.session.user!.username;
  const workspace = bootstrapUserWorkspace(username);

  let session: unknown = null;
  let sessionId: string | undefined;

  if ((await checkOpencodeHealth()) === "up") {
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

  const chamberBase = (config.openchamberUrl || "http://127.0.0.1:3001").replace(
    /\/$/,
    "",
  );

  res.json({
    username,
    workspace,
    sessionId: sessionId ?? null,
    session,
    /** OpenChamber opens at root; open project via OpenCode directory already set on session */
    chamberUrl: chamberBase,
    /** Hint path for manual "Open project" in Chamber */
    openInstructions: `In OpenChamber, open project folder:\n${workspace}`,
    legacyChatUrl: "http://127.0.0.1:5173/",
  });
});

workspaceBindRouter.get("/workspace/bind", requireAuth, (req, res) => {
  const username = req.session.user!.username;
  const workspace = bootstrapUserWorkspace(username);
  res.json({
    username,
    workspace,
    chamberUrl: (config.openchamberUrl || "http://127.0.0.1:3001").replace(
      /\/$/,
      "",
    ),
    sessions: sessionMap.listRecordsByUser(username),
  });
});
