import { spawn, type ChildProcess } from "node:child_process";
import net from "node:net";
import { config } from "../config.js";
import { bootstrapUserWorkspace } from "../workspaceBootstrap.js";
import path from "node:path";
import fs from "node:fs";

export interface PreviewProc {
  username: string;
  port: number;
  cwd: string;
  command: string;
  child: ChildProcess;
  startedAt: string;
}

const previews = new Map<string, PreviewProc>();

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const s = net.createServer();
    s.listen(0, "127.0.0.1", () => {
      const addr = s.address();
      if (addr && typeof addr === "object") {
        const p = addr.port;
        s.close(() => resolve(p));
      } else {
        reject(new Error("no port"));
      }
    });
    s.on("error", reject);
  });
}

function detectCommand(cwd: string, port: number): { cmd: string; args: string[] } {
  if (fs.existsSync(path.join(cwd, "package.json"))) {
    const pkg = JSON.parse(
      fs.readFileSync(path.join(cwd, "package.json"), "utf8"),
    ) as { scripts?: Record<string, string> };
    if (pkg.scripts?.dev) {
      return {
        cmd: "npm",
        args: ["run", "dev", "--", "--host", "127.0.0.1", "--port", String(port)],
      };
    }
    if (pkg.scripts?.start) {
      return {
        cmd: "npm",
        args: ["start", "--", "--port", String(port)],
      };
    }
  }
  // static fallback: python http.server
  return {
    cmd: "python",
    args: ["-m", "http.server", String(port), "--bind", "127.0.0.1"],
  };
}

export async function startPreview(
  username: string,
  opts?: { command?: string },
): Promise<PreviewProc> {
  stopPreview(username);
  const cwd = bootstrapUserWorkspace(username);
  const port = await freePort();

  let cmd: string;
  let args: string[];
  if (opts?.command?.trim()) {
    // simple shell - Windows use cmd
    cmd = process.platform === "win32" ? "cmd" : "sh";
    args =
      process.platform === "win32"
        ? ["/c", opts.command.replace(/\$PORT/g, String(port))]
        : ["-c", opts.command.replace(/\$PORT/g, String(port))];
  } else {
    ({ cmd, args } = detectCommand(cwd, port));
  }

  const child = spawn(cmd, args, {
    cwd,
    env: {
      ...process.env,
      PORT: String(port),
      HOST: "127.0.0.1",
    },
    shell: false,
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
  });

  child.stdout?.on("data", (d: Buffer) => {
    process.stdout.write(`[preview:${username}] ${d}`);
  });
  child.stderr?.on("data", (d: Buffer) => {
    process.stderr.write(`[preview:${username}] ${d}`);
  });
  child.on("exit", () => {
    const cur = previews.get(username);
    if (cur?.child === child) previews.delete(username);
  });

  const rec: PreviewProc = {
    username,
    port,
    cwd,
    command: `${cmd} ${args.join(" ")}`,
    child,
    startedAt: new Date().toISOString(),
  };
  previews.set(username, rec);

  // brief wait for bind
  await new Promise((r) => setTimeout(r, 1200));
  return rec;
}

export function stopPreview(username: string): boolean {
  const rec = previews.get(username);
  if (!rec) return false;
  try {
    rec.child.kill();
  } catch {
    // ignore
  }
  previews.delete(username);
  return true;
}

export function getPreview(username: string): PreviewProc | undefined {
  return previews.get(username);
}

export function listPreviews(): Array<Omit<PreviewProc, "child">> {
  return [...previews.values()].map(({ child: _c, ...rest }) => rest);
}

export function stopAllPreviews(): void {
  for (const u of [...previews.keys()]) stopPreview(u);
}

void config; // keep import for future root paths
