import { Router } from "express";
import multer from "multer";
import path from "node:path";
import fs from "node:fs";
import { requireAuth } from "../auth/requireAuth.js";
import { bootstrapUserWorkspace } from "../workspaceBootstrap.js";
import { resolveWorkspacePath } from "../workspace.js";
import { config } from "../config.js";
import { appendAudit } from "../audit.js";

export const uploadRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

uploadRouter.post(
  "/workspace/upload",
  requireAuth,
  upload.single("file"),
  (req, res) => {
    try {
      const username = req.session.user!.username;
      const root = bootstrapUserWorkspace(username);
      if (!req.file) {
        res.status(400).json({ error: "file required" });
        return;
      }
      const relDir = String(req.body?.dir ?? ".").replace(/^[/\\]+/, "");
      const safeName = path.basename(req.file.originalname).replace(
        /[^\w.\-()+\s가-힣]/g,
        "_",
      );
      const destDir = resolveWorkspacePath(
        config.workspacesRoot,
        username,
        relDir || ".",
      );
      fs.mkdirSync(destDir, { recursive: true });
      const dest = path.join(destDir, safeName);
      // ensure dest still inside workspace
      resolveWorkspacePath(
        config.workspacesRoot,
        username,
        path.relative(root, dest),
      );
      fs.writeFileSync(dest, req.file.buffer);
      const rel = path.relative(root, dest).replaceAll("\\", "/");
      appendAudit("workspace.upload", username, {
        path: rel,
        bytes: req.file.size,
      });
      res.status(201).json({
        ok: true,
        path: rel,
        bytes: req.file.size,
        absolute: dest,
      });
    } catch (e) {
      res.status(400).json({ error: (e as Error).message });
    }
  },
);
