import { Router } from "express";
import { simpleGit } from "simple-git";
import { requireAuth } from "../auth/requireAuth.js";
import { bootstrapUserWorkspace } from "../workspaceBootstrap.js";
import { appendAudit } from "../audit.js";

export const gitRouter = Router();

gitRouter.get("/git/status", requireAuth, async (req, res) => {
  try {
    const cwd = bootstrapUserWorkspace(req.session.user!.username);
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
    const branch = status.current;
    res.json({
      isRepo: true,
      cwd,
      branch,
      ahead: status.ahead,
      behind: status.behind,
      staged: status.staged,
      modified: status.modified,
      not_added: status.not_added,
      deleted: status.deleted,
      conflicted: status.conflicted,
      files: status.files.map((f) => ({ path: f.path, index: f.index, working_dir: f.working_dir })),
    });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

gitRouter.post("/git/init", requireAuth, async (req, res) => {
  try {
    const username = req.session.user!.username;
    const cwd = bootstrapUserWorkspace(username);
    const git = simpleGit(cwd);
    if (await git.checkIsRepo()) {
      res.json({ ok: true, already: true, cwd });
      return;
    }
    await git.init();
    await git.addConfig("user.email", `${username}@local.vibe`, false, "local");
    await git.addConfig("user.name", username, false, "local");
    appendAudit("git.init", username, { cwd });
    res.status(201).json({ ok: true, cwd });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

gitRouter.get("/git/diff", requireAuth, async (req, res) => {
  try {
    const cwd = bootstrapUserWorkspace(req.session.user!.username);
    const git = simpleGit(cwd);
    if (!(await git.checkIsRepo())) {
      res.json({ isRepo: false, diff: "" });
      return;
    }
    const staged = req.query.staged === "1";
    const diff = staged
      ? await git.diff(["--cached"])
      : await git.diff();
    res.json({ isRepo: true, staged, diff });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});
