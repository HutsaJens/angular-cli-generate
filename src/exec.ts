import { spawn } from "node:child_process";
import { isSafeArg } from "./schematics";

export interface RunResult {
  code: number | null;
  output: string;
}

export interface RunOptions {
  cwd: string;
  signal: AbortSignal;
  onOutput: (chunk: string) => void;
}

/**
 * Runs a command without a shell on macOS/Linux. On Windows `npx` and `pnpm` are `.cmd` shims
 * that need a shell, so the command line is assembled here, after checking that every part is
 * free of shell metacharacters.
 */
export function runProcess(command: string, args: readonly string[], options: RunOptions): Promise<RunResult> {
  return new Promise((resolve, reject) => {
    const env: NodeJS.ProcessEnv = { ...process.env, NO_COLOR: "1" };
    delete env.FORCE_COLOR;

    const spawnOptions = {
      cwd: options.cwd,
      env,
      signal: options.signal,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"] as ["ignore", "pipe", "pipe"],
    };

    let child;
    if (process.platform === "win32") {
      const parts = [command, ...args];
      if (!parts.every(isSafeArg)) {
        reject(new Error("Refusing to run a command containing unsafe characters."));
        return;
      }
      child = spawn(parts.join(" "), { ...spawnOptions, shell: true });
    } else {
      child = spawn(command, [...args], spawnOptions);
    }

    let output = "";
    const collect = (data: Buffer) => {
      const text = data.toString("utf8");
      output += text;
      options.onOutput(text);
    };
    child.stdout.on("data", collect);
    child.stderr.on("data", collect);
    child.on("error", reject);
    child.on("close", (code) => resolve({ code, output }));
  });
}
