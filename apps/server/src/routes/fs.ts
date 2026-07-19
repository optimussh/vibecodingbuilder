import { Router } from "express";
import { requireAuth } from "../auth/requireAuth.js";
import {
  listTreeAt,
  readFileAt,
  resolveActiveRoot,
} from "../workspaceRoot.js";

export const fsRouter = Router();

fsRouter.get("/fs", requireAuth, (req, res) => {
  try {
    const username = req.session.user!.username;
    const projectId = req.query.projectId
      ? String(req.query.projectId)
      : undefined;
    const active = resolveActiveRoot(username, projectId);
    const tree = listTreeAt(active.root);
    res.json({
      root: active.label,
      kind: active.kind,
      projectId: active.projectId ?? null,
      path: active.root,
      tree,
    });
  } catch (e) {
    const err = e as Error & { status?: number };
    res.status(err.status ?? 400).json({ error: err.message });
  }
});

fsRouter.get("/fs/content", requireAuth, (req, res) => {
  try {
    const username = req.session.user!.username;
    const projectId = req.query.projectId
      ? String(req.query.projectId)
      : undefined;
    const rel = String(req.query.path ?? "");
    if (!rel) {
      res.status(400).json({ error: "path query required" });
      return;
    }
    const active = resolveActiveRoot(username, projectId);
    const content = readFileAt(active.root, rel);
    res.json({ path: rel, content, projectId: active.projectId ?? null });
  } catch (e) {
    const err = e as Error & { status?: number };
    const status =
      err.status ??
      (/forbidden|escape/i.test(err.message)
        ? 403
        : /not found/i.test(err.message)
          ? 404
          : 400);
    res.status(status).json({ error: err.message });
  }
});
