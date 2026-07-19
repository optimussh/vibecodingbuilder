import { describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "./app.js";

describe("eval harness", () => {
  const app = createApp({ managedOpencode: false });

  it("lists golden tasks when authenticated", async () => {
    const agent = request.agent(app);
    await agent
      .post("/api/auth/login")
      .send({ username: "admin", password: "admin123" });
    const res = await agent.get("/api/eval/tasks");
    expect(res.status).toBe(200);
    expect(res.body.tasks.length).toBeGreaterThan(0);
  });

  it("runs offline eval as admin", async () => {
    const agent = request.agent(app);
    await agent
      .post("/api/auth/login")
      .send({ username: "admin", password: "admin123" });
    const tasks = (await agent.get("/api/eval/tasks")).body.tasks as Array<{
      id: string;
      expectIncludes: string[];
      prompt: string;
    }>;
    const answers: Record<string, string> = {};
    for (const t of tasks) {
      answers[t.id] = [...t.expectIncludes, t.prompt].join(" ");
    }
    const res = await agent.post("/api/eval/run").send({ answers });
    expect(res.status).toBe(200);
    expect(res.body.passRate).toBe(1);
  });
});
