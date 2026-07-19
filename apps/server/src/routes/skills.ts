import { Router } from "express";
import fs from "node:fs";
import path from "node:path";
import { requireAuth, requireAdmin } from "../auth/requireAuth.js";
import { config } from "../config.js";
import { appendAudit } from "../audit.js";
import * as projects from "../projects.js";
import { bootstrapUserWorkspace } from "../workspaceBootstrap.js";

export const skillsRouter = Router();

const skillsRoot = () => path.join(config.projectRoot, "data", "skills");

function ensureSkills(): void {
  fs.mkdirSync(skillsRoot(), { recursive: true });
  const catalog = [
    {
      id: "secure-coding",
      name: "Secure coding checklist",
      description: "Secrets, input validation, least privilege",
      body: `# Secure coding\n\n- No secrets in repo\n- Validate inputs\n- Least privilege for tools\n`,
    },
    {
      id: "pr-hygiene",
      name: "PR hygiene",
      description: "Small diffs, tests, clear description",
      body: `# PR hygiene\n\n- Small reviewable diffs\n- Tests when behavior changes\n- Clear PR summary\n`,
    },
    {
      id: "api-design",
      name: "API design",
      description: "REST consistency and errors",
      body: `# API design\n\n- Consistent error JSON\n- Idempotent writes where possible\n- Auth on every mutating route\n`,
    },
  ];
  for (const s of catalog) {
    const dir = path.join(skillsRoot(), s.id);
    if (fs.existsSync(dir)) continue;
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
      path.join(dir, "skill.json"),
      JSON.stringify(
        { id: s.id, name: s.name, description: s.description },
        null,
        2,
      ),
    );
    fs.writeFileSync(path.join(dir, "SKILL.md"), s.body, "utf8");
  }
}

skillsRouter.get("/skills", requireAuth, (_req, res) => {
  ensureSkills();
  const list = fs
    .readdirSync(skillsRoot(), { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => {
      const metaPath = path.join(skillsRoot(), d.name, "skill.json");
      try {
        return JSON.parse(fs.readFileSync(metaPath, "utf8")) as {
          id: string;
          name: string;
          description: string;
        };
      } catch {
        return { id: d.name, name: d.name, description: "" };
      }
    });
  res.json({ skills: list });
});

skillsRouter.get("/skills/:id", requireAuth, (req, res) => {
  ensureSkills();
  const id = String(req.params.id).replace(/[^a-zA-Z0-9_-]/g, "");
  const md = path.join(skillsRoot(), id, "SKILL.md");
  if (!fs.existsSync(md)) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json({ id, content: fs.readFileSync(md, "utf8") });
});

skillsRouter.post("/skills/:id/apply", requireAuth, (req, res) => {
  ensureSkills();
  const username = req.session.user!.username;
  const id = String(req.params.id).replace(/[^a-zA-Z0-9_-]/g, "");
  const src = path.join(skillsRoot(), id, "SKILL.md");
  if (!fs.existsSync(src)) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  let destRoot: string;
  const projectId = req.body?.projectId
    ? String(req.body.projectId)
    : undefined;
  if (projectId) {
    const p = projects.getProject(projectId);
    if (!p || !projects.canWrite(projects.memberRole(projectId, username))) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    destRoot = p.rootPath;
  } else {
    destRoot = bootstrapUserWorkspace(username);
  }
  const destDir = path.join(destRoot, ".codeharbor", "skills");
  fs.mkdirSync(destDir, { recursive: true });
  const dest = path.join(destDir, `${id}.md`);
  fs.copyFileSync(src, dest);
  // merge into AGENTS.md
  const agents = path.join(destRoot, "AGENTS.md");
  const skillBody = fs.readFileSync(src, "utf8");
  const block = `\n\n## Skill: ${id}\n\n${skillBody}\n`;
  if (fs.existsSync(agents)) {
    const cur = fs.readFileSync(agents, "utf8");
    if (!cur.includes(`## Skill: ${id}`)) {
      fs.appendFileSync(agents, block, "utf8");
    }
  } else {
    fs.writeFileSync(agents, `# AGENTS\n${block}`, "utf8");
  }
  appendAudit("skill.apply", username, { skillId: id, projectId });
  res.json({ ok: true, path: dest });
});

skillsRouter.put("/skills/:id", requireAdmin, (req, res) => {
  ensureSkills();
  const id = String(req.params.id).replace(/[^a-zA-Z0-9_-]/g, "");
  const dir = path.join(skillsRoot(), id);
  fs.mkdirSync(dir, { recursive: true });
  const name = String(req.body?.name ?? id);
  const description = String(req.body?.description ?? "");
  const content = String(req.body?.content ?? "");
  fs.writeFileSync(
    path.join(dir, "skill.json"),
    JSON.stringify({ id, name, description }, null, 2),
  );
  fs.writeFileSync(path.join(dir, "SKILL.md"), content, "utf8");
  appendAudit("skill.upsert", req.session.user!.username, { skillId: id });
  res.json({ ok: true, id });
});
