import * as fs from "node:fs";
import * as path from "node:path";

/** Walks up from `startDir` (inclusive) looking for `fileName`; stops after `stopDir` if given. */
export function findUp(fileName: string, startDir: string, stopDir?: string): string | undefined {
  let dir = path.resolve(startDir);
  const stop = stopDir ? path.resolve(stopDir) : undefined;
  for (;;) {
    const candidate = path.join(dir, fileName);
    if (fs.existsSync(candidate)) return candidate;
    if (dir === stop) return undefined;
    const parent = path.dirname(dir);
    if (parent === dir) return undefined;
    dir = parent;
  }
}
