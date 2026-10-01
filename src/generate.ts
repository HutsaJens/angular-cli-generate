import * as path from "node:path";
import * as vscode from "vscode";
import { runProcess, type RunResult } from "./exec";
import { findUp } from "./fsUtils";
import { buildCommand, isPackageManagerSetting, resolvePackageManager } from "./packageManager";
import {
  isSafeArg,
  parseCreatedFiles,
  pickMainFile,
  summarizeError,
  validateName,
  type Schematic,
} from "./schematics";

export const CONFIG_SECTION = "angularCliGenerate";

/** An error whose message is safe and useful to show to the user as-is. */
export class UserFacingError extends Error {}

interface Target {
  dir: string;
  folder: vscode.WorkspaceFolder | undefined;
  fromExplorer: boolean;
}

async function pickWorkspaceFolder(): Promise<vscode.WorkspaceFolder | undefined> {
  const folders = vscode.workspace.workspaceFolders ?? [];
  if (folders.length === 0) throw new UserFacingError("Open a folder first, then try again.");
  if (folders.length === 1) return folders[0];
  return vscode.window.showWorkspaceFolderPick({ placeHolder: "Select the workspace folder to generate in" });
}

/** Explorer: the clicked folder (or the folder of the clicked file). Palette: folder of the active file, else the workspace folder. */
async function resolveTarget(uri: vscode.Uri | undefined): Promise<Target | undefined> {
  let dirUri: vscode.Uri | undefined;
  if (uri) {
    const stat = await vscode.workspace.fs.stat(uri);
    dirUri = stat.type & vscode.FileType.Directory ? uri : vscode.Uri.joinPath(uri, "..");
  } else {
    const active = vscode.window.activeTextEditor?.document.uri;
    dirUri = active?.scheme === "file" ? vscode.Uri.joinPath(active, "..") : (await pickWorkspaceFolder())?.uri;
  }
  if (!dirUri) return undefined;
  if (dirUri.scheme !== "file") throw new UserFacingError("Only local folders are supported.");
  return { dir: dirUri.fsPath, folder: vscode.workspace.getWorkspaceFolder(dirUri), fromExplorer: uri !== undefined };
}

function readExtraArgs(config: vscode.WorkspaceConfiguration, schematic: Schematic): string[] {
  const value = config.get<Record<string, unknown>>("options", {})[schematic];
  if (value === undefined) return [];
  const setting = `${CONFIG_SECTION}.options.${schematic}`;
  if (!Array.isArray(value) || !value.every((v): v is string => typeof v === "string")) {
    throw new UserFacingError(`The setting "${setting}" must be an array of strings.`);
  }
  const bad = value.find((arg) => !isSafeArg(arg));
  if (bad !== undefined) {
    throw new UserFacingError(`The setting "${setting}" contains an unsupported argument: "${bad}".`);
  }
  return value;
}

const isAbortError = (err: unknown) => err instanceof Error && err.name === "AbortError";

async function openGeneratedFile(relativePath: string, projectDir: string, log: vscode.LogOutputChannel) {
  // The CLI prints paths relative to the Angular workspace root (where angular.json lives).
  const angularJson = findUp("angular.json", projectDir);
  const root = angularJson ? path.dirname(angularJson) : projectDir;
  try {
    const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(path.resolve(root, relativePath)));
    await vscode.window.showTextDocument(doc, { preview: false });
  } catch (err) {
    log.warn(`Could not open ${relativePath}: ${String(err)}`);
  }
}

export async function generate(schematic: Schematic, uri: unknown, log: vscode.LogOutputChannel): Promise<void> {
  const target = await resolveTarget(uri instanceof vscode.Uri ? uri : undefined);
  if (!target) return;

  const config = vscode.workspace.getConfiguration(CONFIG_SECTION, vscode.Uri.file(target.dir));

  const input = await vscode.window.showInputBox({
    ignoreFocusOut: true,
    title: `Generate ${schematic}`,
    prompt: `Enter the ${schematic} name, e.g. user-list or shared/user-list.`,
    value: target.fromExplorer ? path.basename(target.dir) : undefined,
    validateInput: validateName,
  });
  if (input === undefined) return;
  const name = input.trim();

  const extraArgs = readExtraArgs(config, schematic);
  const setting = config.get<string>("packageManager", "auto");
  const { manager } = resolvePackageManager(
    isPackageManagerSetting(setting) ? setting : "auto",
    target.dir,
    target.folder?.uri.fsPath,
  );
  const { command, args } = buildCommand(manager, schematic, name, extraArgs);
  log.info(`$ ${[command, ...args].join(" ")}   (cwd: ${target.dir})`);

  let result: RunResult;
  try {
    result = await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: `Generating ${name} ${schematic} (${manager})...`,
        cancellable: true,
      },
      async (_progress, token) => {
        const controller = new AbortController();
        const subscription = token.onCancellationRequested(() => controller.abort());
        try {
          return await runProcess(command, args, {
            cwd: target.dir,
            signal: controller.signal,
            onOutput: (chunk) => log.info(chunk.trimEnd()),
          });
        } finally {
          subscription.dispose();
        }
      },
    );
  } catch (err) {
    if (isAbortError(err)) {
      log.info("Cancelled.");
      return;
    }
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      throw new UserFacingError(`"${command}" was not found on your PATH. Is ${manager} installed?`);
    }
    throw err;
  }

  if (result.code !== 0) {
    log.error(`Exited with code ${result.code}.`);
    void vscode.window
      .showErrorMessage(`ng generate ${schematic} failed: ${summarizeError(result.output)}`, "Show Output")
      .then((choice) => {
        if (choice) log.show(true);
      });
    return;
  }

  const created = parseCreatedFiles(result.output);
  vscode.window.setStatusBarMessage(`$(check) Generated ${name} ${schematic} (${created.length} files)`, 5000);

  const main = pickMainFile(created);
  if (main && config.get<boolean>("openGeneratedFile", true)) {
    await openGeneratedFile(main, target.dir, log);
  }
}
