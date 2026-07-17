import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import path from "node:path";
import { createSessionMiddleware } from "./auth/session.js";
import { authRouter } from "./auth/routes.js";
import { healthRouter } from "./routes/health.js";
import { sessionsRouter } from "./routes/sessions.js";
import { fsRouter } from "./routes/fs.js";
import { eventsRouter } from "./routes/events.js";
import { adminRouter } from "./routes/admin.js";
import { workspaceRouter } from "./routes/workspace.js";
import { workspaceBindRouter } from "./routes/workspaceBind.js";
import { ragRouter } from "./routes/rag.js";
import { portalRouter } from "./routes/portal.js";
import { loginPageRouter } from "./routes/loginPage.js";
import { quotaRouter } from "./routes/quota.js";
import { stackRouter } from "./routes/stack.js";
import { previewRouter, mountPreviewProxy } from "./routes/preview.js";
import { proxyRouter, mountOpenChamberProxy } from "./routes/proxy.js";
import * as sessionMap from "./sessionMap.js";
import { bootstrapUserWorkspace } from "./workspaceBootstrap.js";
import { config } from "./config.js";
import { publicUserList } from "./users.js";

export interface CreateAppOptions {
  managedOpencode?: boolean;
}

export function createApp(_options: CreateAppOptions = {}) {
  sessionMap.loadFromDisk();
  for (const u of publicUserList()) {
    bootstrapUserWorkspace(u.username);
  }

  const app = express();

  app.use(
    cors({
      origin: [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3001",
      ],
      credentials: true,
    }),
  );
  app.use(express.json({ limit: "2mb" }));
  app.use(cookieParser());
  app.use(createSessionMiddleware());

  app.use(
    "/docs/status",
    express.static(path.join(config.projectRoot, "docs/status")),
  );

  app.get("/api/ping", (_req, res) => {
    res.json({
      ok: true,
      openchamber: {
        enabled: config.openchamberEnabled,
        url: config.openchamberUrl || null,
      },
    });
  });

  app.use("/api/auth", authRouter);
  app.use("/api", healthRouter);
  app.use("/api", sessionsRouter);
  app.use("/api", fsRouter);
  app.use("/api", eventsRouter);
  app.use("/api", adminRouter);
  app.use("/api", workspaceRouter);
  app.use("/api", workspaceBindRouter);
  app.use("/api", ragRouter);
  app.use("/api", quotaRouter);
  app.use("/api", stackRouter);
  app.use("/api", previewRouter);

  app.use(proxyRouter);
  mountOpenChamberProxy(app);
  mountPreviewProxy(app);

  app.use(loginPageRouter);
  app.use(portalRouter);

  return app;
}
