import { describe, expect, it } from "vitest";
import {
  buildChamberOpenPath,
  buildChamberOpenUrl,
  chamberAutoOpenBootstrapScript,
} from "./chamberUrl.js";

describe("chamberUrl", () => {
  it("builds gateway path with directory and sessionId", () => {
    const p = buildChamberOpenPath({
      workspace: "C:\\\\ws\\\\user1",
      sessionId: "ses_abc",
    });
    expect(p.startsWith("/chamber/?")).toBe(true);
    expect(p).toContain("sessionId=ses_abc");
    expect(decodeURIComponent(p)).toContain("directory=");
  });

  it("builds absolute chamber open URL via gateway", () => {
    const u = buildChamberOpenUrl({
      workspace: "/data/workspaces/admin",
      sessionId: "s1",
      viaGateway: true,
    });
    expect(u).toContain("/chamber/");
    expect(u).toContain("sessionId=s1");
    expect(u).toContain(encodeURIComponent("/data/workspaces/admin"));
  });

  it("emits bootstrap that listens for app-ready", () => {
    const s = chamberAutoOpenBootstrapScript();
    expect(s).toContain("openchamber:app-ready");
    expect(s).toContain("openchamber:open-session");
    expect(s).toContain("openchamber:open-draft-session");
  });
});
