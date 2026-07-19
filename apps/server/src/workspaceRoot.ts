import fs from "node:fs";
import path from "node:path";
import type { FileNode } from "./types.js";
import { config } from "./config.js";
import { ensureWorkspace } from "./workspace.js";
import * as projects from "./projects.js";

const IGNORE = new Set(["node_modules", ".git", ".DS_Store", "Thumbs.db"]);

export type ActiveRoot = {
  root: string;
  kind: "personal" | "project";
  projectId?: string;
  label: string;
};

export function resolveActiveRoot(
  username: string,
  projectId?: string | null,
): ActiveRoot {
  if (projectId) {
    const p = projects.getProject(projectId);
    if (!p) throw Object.assign(new Error("Project not found"), { status: 404 });
    const role = projects.memberRole(projectId, username);
    if (!projects.canRead(role)) {
      throw Object.assign(new Error("Forbidden"), { status: 403 });
    }
    return {
      root: path.resolve(p.rootPath),
      kind: "project",
      projectId,
      label: p.slug,
    };
  }
  return {
    root: ensureWorkspace(config.workspacesRoot, username),
    kind: "personal",
    label: username,
  };
}

export function resolvePathInRoot(root: string, relativePath = "."): string {
  const base = path.resolve(root);
  const target = path.resolve(base, relativePath);
  const rel = path.relative(base, target);
  if (rel.startsWith("..") || path.isAbsolute(rel)) {
    throw new Error("Path escapes workspace (forbidden)");
  }
  return target;
}

export function listTreeAt(
  root: string,
  relativePath = ".",
  depth = 0,
  maxDepth = 5,
): FileNode[] {
  const abs = resolvePathInRoot(root, relativePath);
  if (!fs.existsSync(abs)) return [];
  if (!fs.statSync(abs).isDirectory()) return [];
  const entries = fs.readdirSync(abs, { withFileTypes: true });
  const nodes: FileNode[] = [];
  for (const entry of entries) {
    if (IGNORE.has(entry.name)) continue;
    const childRel =
      relativePath === "."
        ? entry.name
        : path.posix.join(relativePath.replaceAll("\\", "/"), entry.name);
    if (entry.isDirectory()) {
      nodes.push({
        name: entry.name,
        path: childRel,
        type: "directory",
        children:
          depth < maxDepth
            ? listTreeAt(root, childRel, depth + 1, maxDepth)
            : [],
      });
    } else if (entry.isFile()) {
      nodes.push({ name: entry.name, path: childRel, type: "file" });
    }
  }
  nodes.sort((a, b) => {
    if (a.type !== b.type) return a.type === "directory" ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
  return nodes;
}

export function readFileAt(
  root: string,
  relativePath: string,
  maxBytes = 1_000_000,
): string {
  const abs = resolvePathInRoot(root, relativePath);
  if (!fs.existsSync(abs) || !fs.statSync(abs).isFile()) {
    throw new Error("File not found");
  }
  if (fs.statSync(abs).size > maxBytes) {
    throw new Error("File too large");
  }
  return fs.readFileSync(abs, "utf8");
}

/** Load org + optional team steering text for agent prompt prefix */
export function loadSteeringContext(): string {
  try {
    const org = path.join(config.steeringRoot, "org.md");
    if (!fs.existsSync(org)) return "";
    const body = fs.readFileSync(org, "utf8").trim();
    if (!body) return "";
    return `## CodeHarbor steering rules\n${body}\n\n---\n\n`;
  } catch {
    return "";
  }
}
