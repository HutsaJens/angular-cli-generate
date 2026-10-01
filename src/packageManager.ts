import * as fs from "node:fs";
import * as path from "node:path";

export type PackageManager = "npm" | "pnpm";
export type PackageManagerSetting = "auto" | PackageManager;
export type PackageManagerSource = "setting" | "detected" | "default";

export function isPackageManagerSetting(value: unknown): value is PackageManagerSetting {
  return value === "auto" || value === "npm" || value === "pnpm";
}

function fromPackageManagerField(dir: string): PackageManager | undefined {
  try {
    const json = JSON.parse(fs.readFileSync(path.join(dir, "package.json"), "utf8")) as { packageManager?: unknown };
    if (typeof json.packageManager !== "string") return undefined;
    const name = json.packageManager.split("@")[0];
    return name === "pnpm" || name === "npm" ? name : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Nearest wins: in each directory (walking up) the `packageManager` field in package.json is
 * checked first, then lockfiles. Stops after `stopDir` (usually the workspace folder).
 */
export function detectPackageManager(startDir: string, stopDir?: string): PackageManager | undefined {
  let dir = path.resolve(startDir);
  const stop = stopDir ? path.resolve(stopDir) : undefined;
  const has = (file: string) => fs.existsSync(path.join(dir, file));
  for (;;) {
    const declared = fromPackageManagerField(dir);
    if (declared) return declared;
    if (has("pnpm-lock.yaml") || has("pnpm-workspace.yaml")) return "pnpm";
    if (has("package-lock.json") || has("npm-shrinkwrap.json")) return "npm";
    if (dir === stop) return undefined;
    const parent = path.dirname(dir);
    if (parent === dir) return undefined;
    dir = parent;
  }
}

export function resolvePackageManager(
  setting: PackageManagerSetting,
  startDir: string,
  stopDir?: string,
): { manager: PackageManager; source: PackageManagerSource } {
  if (setting !== "auto") return { manager: setting, source: "setting" };
  const detected = detectPackageManager(startDir, stopDir);
  return detected ? { manager: detected, source: "detected" } : { manager: "npm", source: "default" };
}

/** The executable plus args that run the workspace's local Angular CLI with the chosen package manager. */
export function buildCommand(
  manager: PackageManager,
  schematic: string,
  name: string,
  extraArgs: readonly string[],
): { command: string; args: string[] } {
  const generate = ["ng", "generate", schematic, name, ...extraArgs];
  return manager === "pnpm"
    ? { command: "pnpm", args: ["exec", ...generate] }
    : { command: "npx", args: generate };
}
