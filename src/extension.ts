import * as vscode from "vscode";
import { CONFIG_SECTION, generate, UserFacingError } from "./generate";
import { registerPackageManagerUi } from "./packageManagerUi";
import { SCHEMATICS } from "./schematics";

export function activate(context: vscode.ExtensionContext): void {
  const log = vscode.window.createOutputChannel("Angular CLI Generate", { log: true });
  context.subscriptions.push(log);

  for (const schematic of SCHEMATICS) {
    context.subscriptions.push(
      vscode.commands.registerCommand(`${CONFIG_SECTION}.${schematic}`, async (uri?: unknown) => {
        try {
          await generate(schematic, uri, log);
        } catch (err) {
          if (err instanceof UserFacingError) {
            void vscode.window.showErrorMessage(err.message);
          } else {
            log.error(err instanceof Error ? (err.stack ?? err.message) : String(err));
            void vscode.window
              .showErrorMessage(`Failed to generate ${schematic}.`, "Show Output")
              .then((choice) => choice && log.show(true));
          }
        }
      }),
    );
  }

  registerPackageManagerUi(context);
}

export function deactivate(): void {}
