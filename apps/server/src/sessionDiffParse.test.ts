import { describe, expect, it } from "vitest";
import { parseSessionDiff } from "./sessionDiffParse.js";

describe("parseSessionDiff", () => {
  it("parses array of file objects", () => {
    const entries = parseSessionDiff([
      { path: "src/a.ts", additions: 3, deletions: 1, patch: "+x\n-y" },
      { file: "b.md", status: "modified" },
    ]);
    expect(entries).toHaveLength(2);
    expect(entries![0]!.path).toBe("src/a.ts");
    expect(entries![0]!.additions).toBe(3);
    expect(entries![1]!.path).toBe("b.md");
  });

  it("parses { files: [...] } envelope", () => {
    const entries = parseSessionDiff({
      files: [{ filePath: "x.txt", diff: "@@\n+hi" }],
    });
    expect(entries).toHaveLength(1);
    expect(entries![0]!.path).toBe("x.txt");
    expect(entries![0]!.patch).toBe("@@\n+hi");
  });

  it("returns null for empty / unknown", () => {
    expect(parseSessionDiff(null)).toBeNull();
    expect(parseSessionDiff({})).toBeNull();
    expect(parseSessionDiff("not-json")).toBeNull();
  });
});
