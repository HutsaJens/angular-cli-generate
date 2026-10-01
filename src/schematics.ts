export const SCHEMATICS = [
  "appShell",
  "application",
  "class",
  "component",
  "directive",
  "enum",
  "environments",
  "guard",
  "interceptor",
  "interface",
  "library",
  "module",
  "pipe",
  "service",
  "serviceWorker",
  "webWorker",
] as const;

export type Schematic = (typeof SCHEMATICS)[number];

/** Letters, digits and the characters Angular names/paths use. No spaces or shell metacharacters. */
const NAME_PATTERN = /^[A-Za-z0-9@_][\w\-./@]*$/;

/** Anything passed to the CLI as an argument must match this (defence in depth for the Windows shell). */
const SAFE_ARG = /^[\w\-./@:,=]+$/;

/** Returns an error message, or `undefined` when the name is valid. */
export function validateName(value: string): string | undefined {
  const name = value.trim();
  if (!name) return "A name is required.";
  if (!NAME_PATTERN.test(name)) return "Use only letters, numbers, - _ . / and @.";
  if (name.split("/").includes("..")) return "Path segments like '..' are not allowed.";
  return undefined;
}

export function isSafeArg(arg: string): boolean {
  return SAFE_ARG.test(arg);
}

/** Extracts file paths from CLI output lines such as `CREATE src/app/a/a.ts (123 bytes)`. */
export function parseCreatedFiles(output: string): string[] {
  return [...output.matchAll(/^CREATE\s+(.+?)\s+\(\d+ bytes\)\s*$/gm)].flatMap((m) => (m[1] ? [m[1]] : []));
}

/** The file worth opening: the first non-spec `.ts` file, otherwise the first created file. */
export function pickMainFile(files: readonly string[]): string | undefined {
  return files.find((f) => f.endsWith(".ts") && !f.endsWith(".spec.ts")) ?? files[0];
}

/** One-line summary of a failed run for the error toast. */
export function summarizeError(output: string): string {
  const lines = output
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  return lines.find((l) => /error|ERR_/i.test(l)) ?? lines.at(-1) ?? "Unknown error.";
}
