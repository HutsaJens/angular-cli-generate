import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildCommand, detectPackageManager, resolvePackageManager } from "../packageManager";

let root: string;
const touch = (rel: string, content = "") => {
  const file = path.join(root, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
};

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), "ncg-"));
});
afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

describe("detectPackageManager", () => {
  it("detects pnpm from its lockfile, walking up from a nested folder", () => {
    touch("pnpm-lock.yaml");
    fs.mkdirSync(path.join(root, "src/app/foo"), { recursive: true });
    expect(detectPackageManager(path.join(root, "src/app/foo"), root)).toBe("pnpm");
  });
  it("detects npm from package-lock.json", () => {
    touch("package-lock.json");
    expect(detectPackageManager(root, root)).toBe("npm");
  });
  it("prefers the packageManager field over lockfiles in the same folder", () => {
    touch("package.json", JSON.stringify({ packageManager: "pnpm@9.1.0" }));
    touch("package-lock.json");
    expect(detectPackageManager(root, root)).toBe("pnpm");
  });
  it("ignores unsupported managers and returns undefined without hints", () => {
    touch("package.json", JSON.stringify({ packageManager: "yarn@4.0.0" }));
    expect(detectPackageManager(root, root)).toBeUndefined();
  });
  it("nearest folder wins", () => {
    touch("package-lock.json");
    touch("apps/web/pnpm-lock.yaml");
    expect(detectPackageManager(path.join(root, "apps/web"), root)).toBe("pnpm");
  });
  it("does not look above stopDir", () => {
    touch("pnpm-lock.yaml");
    fs.mkdirSync(path.join(root, "inner"), { recursive: true });
    expect(detectPackageManager(path.join(root, "inner"), path.join(root, "inner"))).toBeUndefined();
  });
});

describe("resolvePackageManager", () => {
  it("honours an explicit setting", () => {
    touch("pnpm-lock.yaml");
    expect(resolvePackageManager("npm", root, root)).toEqual({ manager: "npm", source: "setting" });
  });
  it("auto detects, then falls back to npm", () => {
    expect(resolvePackageManager("auto", root, root)).toEqual({ manager: "npm", source: "default" });
    touch("pnpm-lock.yaml");
    expect(resolvePackageManager("auto", root, root)).toEqual({ manager: "pnpm", source: "detected" });
  });
});

describe("buildCommand", () => {
  it("uses npx for npm", () => {
    expect(buildCommand("npm", "component", "foo", ["--skip-tests"])).toEqual({
      command: "npx",
      args: ["ng", "generate", "component", "foo", "--skip-tests"],
    });
  });
  it("uses pnpm exec for pnpm", () => {
    expect(buildCommand("pnpm", "service", "foo", [])).toEqual({
      command: "pnpm",
      args: ["exec", "ng", "generate", "service", "foo"],
    });
  });
});
