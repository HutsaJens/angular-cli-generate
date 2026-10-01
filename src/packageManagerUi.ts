import * as vscode from "vscode";
import { findUp } from "./fsUtils";
import { CONFIG_SECTION } from "./generate";
import {
  detectPackageManager,
  isPackageManagerSetting,
  resolvePackageManager,
  type PackageManagerSetting,
} from "./packageManager";

export const SWITCH_COMMAND = `${CONFIG_SECTION}.switchPackageManager`;

/** The folder the status bar and the switcher talk about: folder of the active file, else the first workspace folder. */
function contextFolder(): { dir: string; root: string | undefined; uri: vscode.Uri } | undefined {
  const active = vscode.window.activeTextEditor?.document.uri;
  const uri = active?.scheme === "file" ? active : vscode.workspace.workspaceFolders?.[0]?.uri;
  if (!uri) return undefined;
  const folder = vscode.workspace.getWorkspaceFolder(uri) ?? vscode.workspace.workspaceFolders?.[0];
  const dir = active?.scheme === "file" ? vscode.Uri.joinPath(active, "..").fsPath : uri.fsPath;
  return { dir, root: folder?.uri.fsPath, uri };
}

function readSetting(config: vscode.WorkspaceConfiguration): PackageManagerSetting {
  const value = config.get<string>("packageManager", "auto");
  return isPackageManagerSetting(value) ? value : "auto";
}

async function switchPackageManager(): Promise<void> {
  const ctx = contextFolder();
  const config = vscode.workspace.getConfiguration(CONFIG_SECTION, ctx?.uri);
  const current = readSetting(config);
  const detected = ctx ? detectPackageManager(ctx.dir, ctx.root) : undefined;

  const items: Array<vscode.QuickPickItem & { value: PackageManagerSetting }> = [
    { label: "npm", value: "npm", description: current === "npm" ? "current" : undefined, detail: "Runs npx ng generate ..." },
    { label: "pnpm", value: "pnpm", description: current === "pnpm" ? "current" : undefined, detail: "Runs pnpm exec ng generate ..." },
    {
      label: "Auto-detect",
      value: "auto",
      description: [current === "auto" ? "current" : undefined, detected ? `detected: ${detected}` : "falls back to npm"]
        .filter(Boolean)
        .join(" · "),
      detail: "Uses the packageManager field in package.json, then the lockfile",
    },
  ];

  const pick = await vscode.window.showQuickPick(items, {
    title: "Angular CLI Generate: Package Manager",
    placeHolder: `Currently: ${current}`,
  });
  if (!pick) return;

  const target = ctx ? vscode.ConfigurationTarget.WorkspaceFolder : vscode.ConfigurationTarget.Global;
  await config.update("packageManager", pick.value, target);
}

export function registerPackageManagerUi(context: vscode.ExtensionContext): void {
  const item = vscode.window.createStatusBarItem("angularCliGenerate.packageManager", vscode.StatusBarAlignment.Right, 90);
  item.name = "Angular CLI Generate: Package Manager";
  item.command = SWITCH_COMMAND;

  const refresh = () => {
    const ctx = contextFolder();
    const config = vscode.workspace.getConfiguration(CONFIG_SECTION, ctx?.uri);
    if (!ctx || !config.get<boolean>("showStatusBarItem", true) || !findUp("angular.json", ctx.dir, ctx.root)) {
      item.hide();
      return;
    }
    const { manager, source } = resolvePackageManager(readSetting(config), ctx.dir, ctx.root);
    item.text = `$(package) ${manager}${source === "setting" ? "" : " (auto)"}`;
    item.tooltip = `Angular CLI Generate runs ng with ${manager} (${source === "setting" ? "from settings" : "auto-detected"}). Click to switch.`;
    item.show();
  };

  context.subscriptions.push(
    item,
    vscode.commands.registerCommand(SWITCH_COMMAND, switchPackageManager),
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration(CONFIG_SECTION)) refresh();
    }),
    vscode.window.onDidChangeActiveTextEditor(refresh),
    vscode.workspace.onDidChangeWorkspaceFolders(refresh),
  );
  refresh();
}
