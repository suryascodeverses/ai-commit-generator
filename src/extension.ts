import * as vscode from "vscode";
import { exec } from "child_process";

const EMPTY_TREE_HASH = "4b825dc642cb6eb9a060e54bf8d69288fbee4904";

export function activate(context: vscode.ExtensionContext) {
  const outputChannel = vscode.window.createOutputChannel(
    "AI Commit Generator"
  );

  const disposable = vscode.commands.registerCommand(
    "ai-commit-generator.showStagedDiff",
    async () => {
      outputChannel.clear();
      outputChannel.show(true);

      const workspaceFolders = vscode.workspace.workspaceFolders;
      if (!workspaceFolders || workspaceFolders.length === 0) {
        vscode.window.showErrorMessage("No workspace folder is open.");
        return;
      }

      const workspacePath = workspaceFolders[0].uri.fsPath;

      // 1️⃣ Resolve Git root
      exec(
        "git rev-parse --show-toplevel",
        { cwd: workspacePath },
        (rootErr, gitRootStdout) => {
          if (rootErr) {
            outputChannel.appendLine("❌ Not inside a Git repository.");
            return;
          }

          const gitRoot = gitRootStdout.trim();

          // 2️⃣ Check if HEAD exists
          exec("git rev-parse --verify HEAD", { cwd: gitRoot }, (headErr) => {
            const diffCommand = headErr
              ? `git diff-index --cached ${EMPTY_TREE_HASH} --`
              : "git diff-index --cached HEAD --";

            // 3️⃣ Read staged changes
            exec(
              diffCommand,
              { cwd: gitRoot, maxBuffer: 10 * 1024 * 1024 },
              (diffErr, stdout, stderr) => {
                if (diffErr) {
                  outputChannel.appendLine("❌ Failed to read staged changes");
                  outputChannel.appendLine(stderr || diffErr.message);
                  return;
                }

                if (!stdout.trim()) {
                  outputChannel.appendLine("ℹ️ No staged changes found.");
                  return;
                }

                outputChannel.appendLine(
                  headErr
                    ? "=== STAGED CHANGES (INITIAL COMMIT) ==="
                    : "=== STAGED CHANGES (INDEX vs HEAD) ==="
                );

                outputChannel.appendLine(stdout);
              }
            );
          });
        }
      );
    }
  );

  context.subscriptions.push(disposable);
}

export function deactivate() {}
