import { Router } from "express";
import multer from "multer";
import path from "node:path";
import fs from "node:fs";
import { requireAuth } from "../auth/requireAuth.js";
import { appendAudit } from "../audit.js";
import {
  resolveActiveRoot,
  resolvePathInRoot,
} from "../workspaceRoot.js";
import * as projects from "../projects.js";

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
      const projectId = req.body?.projectId
        ? String(req.body.projectId)
        : undefined;
      if (projectId) {
        const role = projects.memberRole(projectId, username);
        if (!projects.canWrite(role)) {
          res.status(403).json({ error: "Forbidden" });
          return;
        }
      }
      const active = resolveActiveRoot(username, projectId);
      if (!req.file) {
        res.status(400).json({ error: "file required" });
        return;
      }
      const relDir = String(req.body?.dir ?? ".").replace(/^[/\\]+/, "");
      const safeName = path.basename(req.file.originalname).replace(
        /[^\w.\-()+\s가-힣]/g,
        "_",
      );
      const destDir = resolvePathInRoot(active.root, relDir || ".");
      fs.mkdirSync(destDir, { recursive: true });
      const dest = path.join(destDir, safeName);
      resolvePathInRoot(active.root, path.relative(active.root, dest));
      fs.writeFileSync(dest, req.file.buffer);
      const rel = path.relative(active.root, dest).replaceAll("\\", "/");
      appendAudit("workspace.upload", username, {
        path: rel,
        projectId,
        bytes: req.file.size,
      });
      res.status(201).json({ path: rel, bytes: req.file.size });
    } catch (e) {
      const err = e as Error & { status?: number };
      res.status(err.status ?? 400).json({ error: err.message });
    }
  },
);
