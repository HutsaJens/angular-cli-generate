# Angular CLI Generate

Right-click a folder in the Explorer and run any `ng generate` schematic, using **npm or pnpm**.

## Usage

- **Explorer:** right-click a folder → **Angular Generate** → pick a schematic → enter a name.
  The name defaults to the folder name; `shared/user-list` style paths work.
- **Command Palette:** `Angular CLI: Generate Component` etc. The target folder is the folder of the
  active file, or the workspace folder if no file is open.
- **Switch package manager:** click the status bar item (shown in Angular workspaces), use
  `Angular CLI: Switch Package Manager...`, or right-click → Angular Generate → Package Manager...

| Package manager | Command that runs                       |
| --------------- | --------------------------------------- |
| npm             | `npx ng generate <schematic> ...`       |
| pnpm            | `pnpm exec ng generate <schematic> ...` |

## Settings

| Setting                                | Default | Description                                                                                                                                             |
| -------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `angularCliGenerate.packageManager`    | `auto`  | `auto`, `npm` or `pnpm`. Auto checks the `packageManager` field in `package.json`, then `pnpm-lock.yaml` / `package-lock.json`, then falls back to npm. |
| `angularCliGenerate.options`           | `{}`    | Extra args per schematic, e.g. `{ "component": ["--style=scss", "--skip-tests"] }`.                                                                     |
| `angularCliGenerate.openGeneratedFile` | `true`  | Open the main generated file afterwards.                                                                                                                |
| `angularCliGenerate.showStatusBarItem` | `true`  | Show the active package manager in the status bar.                                                                                                      |

Arguments may only contain letters, digits and `- _ . / @ : , =`; anything else is refused.

## Security

The extension runs the Angular CLI, which executes code from your workspace, so it is disabled in
untrusted workspaces. It does not support virtual workspaces and runs on the workspace side in
remote setups (`extensionKind: ["workspace"]`).

## Development

```sh
npm install        # or: pnpm install
npm run watch      # then press F5 ("Run Extension")
npm run typecheck && npm run lint && npm test
npm run package    # builds a .vsix (vsce package --no-dependencies)
```

## Releases

Pull requests to `main` run the checks above. When a push to `main` changes `package.json`'s
version, the workflow packages the extension and uploads `extension.vsix` as a downloadable
artifact on the GitHub Actions run. It does not publish to either marketplace.
