import { Router } from "express";
import { config } from "../config.js";
import { checkOpencodeHealth, llmStatus } from "../opencode/client.js";
import { checkRagDb } from "../rag/db.js";

export const stackRouter = Router();

async function probe(url: string, timeoutMs = 2500): Promise<"up" | "down"> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
    return res.ok || res.status < 500 ? "up" : "down";
  } catch {
    return "down";
  }
}

/** Public-ish stack map for local ops (no secrets) */
stackRouter.get("/stack", async (_req, res) => {
  const [opencode, rag, chamber] = await Promise.all([
    checkOpencodeHealth(),
    checkRagDb(),
    config.openchamberUrl
      ? probe(`${config.openchamberUrl.replace(/\/$/, "")}/health`)
      : Promise.resolve("down" as const),
  ]);

  res.json({
    ports: {
      platform: config.port,
      webLegacy: 5173,
      openchamber: 3001,
      opencode: 4096,
      postgres: 5433,
    },
    services: {
      platform: "up",
      opencode,
      rag,
      llm: llmStatus(),
      openchamber: chamber,
      openchamberProxy: config.openchamberEnabled ? "enabled" : "disabled",
    },
    urls: {
      portal: `http://127.0.0.1:${config.port}/`,
      login: `http://127.0.0.1:${config.port}/login?next=/chamber`,
      chamber: `http://127.0.0.1:${config.port}/chamber`,
      legacy: "http://localhost:5173",
      statusBoard: `http://127.0.0.1:${config.port}/docs/status/index.html`,
      opencodeProxy: `http://127.0.0.1:${config.port}/opencode/global/health`,
      openchamberDirect: config.openchamberUrl || null,
      opencodeDirect: config.opencodeBaseUrl,
    },
    wiring: {
      openchamberUsesExternalOpenCode: true,
      openCodePort: 4096,
      openChamberPort: 3001,
      platformProxiesChamberAt: "/chamber",
      platformProxiesOpenCodeAt: "/opencode",
    },
  });
});
