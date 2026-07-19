import { Router } from "express";
import { simpleGit } from "simple-git";
import { requireAuth } from "../auth/requireAuth.js";
import { appendAudit } from "../audit.js";
import { resolveActiveRoot } from "../workspaceRoot.js";
import * as projects from "../projects.js";

export const gitRouter = Router();

function cwdOf(req: {
  session: { user?: { username: string } };
  query: Record<string, unknown>;
  body?: Record<string, unknown>;
}): string {
  const username = req.session.user!.username;
  const projectId =
    (req.query.projectId as string | undefined) ||
    (req.body?.projectId as string | undefined);
  if (projectId) {
    const role = projects.memberRole(projectId, username);
    if (!projects.canRead(role)) {
      throw Object.assign(new Error("Forbidden"), { status: 403 });
    }
  }
  return resolveActiveRoot(username, projectId).root;
}

gitRouter.get("/git/status", requireAuth, async (req, res) => {
  try {
    const cwd = cwdOf(req as never);
    const git = simpleGit(cwd);
    const isRepo = await git.checkIsRepo();
    if (!isRepo) {
      res.json({
        isRepo: false,
        cwd,
        message: "Not a git repository — POST /api/git/init to initialize",
      });
      return;
    }
    const status = await git.status();
    res.json({
      isRepo: true,
      cwd,
      branch: status.current,
      ahead: status.ahead,
      behind: status.behind,
      staged: status.staged,
      modified: status.modified,
      not_added: status.not_added,
      deleted: status.deleted,
      conflicted: status.conflicted,
      files: status.files.map((f) => ({
        path: f.path,
        index: f.index,
        working_dir: f.working_dir,
      })),
    });
  } catch (e) {
    const err = e as Error & { status?: number };
    res.status(err.status ?? 500).json({ error: err.message });
  }
});

gitRouter.post("/git/init", requireAuth, async (req, res) => {
  try {
    const username = req.session.user!.username;
    const projectId = req.body?.projectId
      ? String(req.body.projectId)
      : undefined;
    if (projectId && !projects.canWrite(projects.memberRole(projectId, username))) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    const cwd = resolveActiveRoot(username, projectId).root;
    const git = simpleGit(cwd);
    if (await git.checkIsRepo()) {
      res.json({ ok: true, already: true, cwd });
      return;
    }
    await git.init();
    await git.addConfig(
      "user.email",
      `${username}@local.codeharbor`,
      false,
      "local",
    );
    await git.addConfig("user.name", username, false, "local");
    appendAudit("git.init", username, { cwd, projectId });
    res.status(201).json({ ok: true, cwd });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

gitRouter.get("/git/diff", requireAuth, async (req, res) => {
  try {
    const cwd = cwdOf(req as never);
    const git = simpleGit(cwd);
    if (!(await git.checkIsRepo())) {
      res.json({ isRepo: false, diff: "" });
      return;
    }
    const staged = req.query.staged === "1";
    const diff = staged ? await git.diff(["--cached"]) : await git.diff();
    res.json({ isRepo: true, staged, diff });
  } catch (e) {
    const err = e as Error & { status?: number };
    res.status(err.status ?? 500).json({ error: err.message });
  }
});
