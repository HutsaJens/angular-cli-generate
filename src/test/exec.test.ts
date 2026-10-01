import { describe, expect, it } from "vitest";
import { runProcess } from "../exec";

const base = { cwd: process.cwd(), onOutput: () => {} };

describe("runProcess", () => {
  it("captures stdout and stderr and the exit code", async () => {
    const chunks: string[] = [];
    const result = await runProcess("node", ["-e", "console.log('out');console.error('err');process.exit(3)"], {
      ...base,
      signal: new AbortController().signal,
      onOutput: (c) => chunks.push(c),
    });
    expect(result.code).toBe(3);
    expect(result.output).toContain("out");
    expect(result.output).toContain("err");
    expect(chunks.join("")).toBe(result.output);
  });

  it("rejects with an AbortError when cancelled", async () => {
    const controller = new AbortController();
    const run = runProcess("node", ["-e", "setTimeout(()=>{},10000)"], { ...base, signal: controller.signal });
    setTimeout(() => controller.abort(), 100);
    await expect(run).rejects.toMatchObject({ name: "AbortError" });
  });

  it("rejects with ENOENT for a missing executable", async () => {
    await expect(
      runProcess("definitely-not-a-real-binary", [], { ...base, signal: new AbortController().signal }),
    ).rejects.toMatchObject({ code: "ENOENT" });
  });
});
