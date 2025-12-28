import * as vscode from "vscode";
import { exec } from "child_process";
import { OpenAIProvider } from "./ai/providers/openai";
import { DeepSeekProvider } from "./ai/providers/deepseek";
import { GeminiProvider } from "./ai/providers/gemini";

const EMPTY_TREE_HASH = "4b825dc642cb6eb9a060e54bf8d69288fbee4904";

function getStagedDiff(workspacePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    exec(
      "git rev-parse --show-toplevel",
      { cwd: workspacePath },
      (rootErr, gitRootStdout) => {
        if (rootErr) {
          reject("Not inside a Git repository.");
          return;
        }

        const gitRoot = gitRootStdout.trim();

        exec("git rev-parse --verify HEAD", { cwd: gitRoot }, (headErr) => {
          const diffCommand = headErr
            ? `git diff-index --cached ${EMPTY_TREE_HASH} --`
            : "git diff-index --cached HEAD --";

          exec(
            diffCommand,
            { cwd: gitRoot, maxBuffer: 10 * 1024 * 1024 },
            (diffErr, stdout, stderr) => {
              if (diffErr) {
                reject(stderr || diffErr.message);
                return;
              }

              if (!stdout.trim()) {
                resolve("");
                return;
              }

              resolve(stdout);
            }
          );
        });
      }
    );
  });
}

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

      try {
        const diff = await getStagedDiff(workspaceFolders[0].uri.fsPath);

        if (!diff) {
          outputChannel.appendLine("ℹ️ No staged changes found.");
          return;
        }

        outputChannel.appendLine("=== STAGED CHANGES ===");
        outputChannel.appendLine(diff);
      } catch (err: any) {
        outputChannel.appendLine("❌ Failed to read staged changes");
        outputChannel.appendLine(String(err));
      }
    }
  );

  const generateCommitDisposable = vscode.commands.registerCommand(
    "ai-commit-generator.generateCommitMessage",
    async () => {
      const outputChannel = vscode.window.createOutputChannel(
        "AI Commit Generator"
      );
      outputChannel.clear();
      outputChannel.show(true);

      const apiKey = await context.secrets.get("openai.apiKey");
      if (!apiKey) {
        vscode.window.showErrorMessage(
          "OpenAI API key not set. Run: AI Commit Generator: Set OpenAI API Key"
        );
        return;
      }

      const workspaceFolders = vscode.workspace.workspaceFolders;
      if (!workspaceFolders || workspaceFolders.length === 0) {
        vscode.window.showErrorMessage("No workspace folder is open.");
        return;
      }

      try {
        const diff = await getStagedDiff(workspaceFolders[0].uri.fsPath);

        if (!diff) {
          vscode.window.showInformationMessage(
            "No staged changes to generate commit message."
          );
          return;
        }

        const provider = new OpenAIProvider(apiKey);

        outputChannel.appendLine("🤖 Generating commit message...\n");

        const message = await provider.generateCommitMessage({ diff });

        outputChannel.appendLine("=== GENERATED COMMIT MESSAGE ===\n");
        outputChannel.appendLine(message);
      } catch (err: any) {
        outputChannel.appendLine("❌ Failed to generate commit message");
        outputChannel.appendLine(String(err));
      }
    }
  );

  context.subscriptions.push(disposable);
  context.subscriptions.push(generateCommitDisposable);

  const setKeyDisposable = vscode.commands.registerCommand(
    "ai-commit-generator.setOpenAIKey",
    async () => {
      const key = await vscode.window.showInputBox({
        prompt: "Enter your OpenAI API key",
        password: true,
        ignoreFocusOut: true,
      });

      if (!key) return;

      await context.secrets.store("openai.apiKey", key);
      vscode.window.showInformationMessage("OpenAI API key saved securely.");
    }
  );

  context.subscriptions.push(setKeyDisposable);

  const setDeepSeekKeyDisposable = vscode.commands.registerCommand(
    "ai-commit-generator.setDeepSeekKey",
    async () => {
      const key = await vscode.window.showInputBox({
        prompt: "Enter your DeepSeek API key",
        password: true,
        ignoreFocusOut: true,
      });

      if (!key) return;

      await context.secrets.store("deepseek.apiKey", key);
      vscode.window.showInformationMessage("DeepSeek API key saved securely.");
    }
  );

  context.subscriptions.push(setDeepSeekKeyDisposable);

  const generateDeepSeekDisposable = vscode.commands.registerCommand(
    "ai-commit-generator.generateCommitMessageDeepSeek",
    async () => {
      const outputChannel = vscode.window.createOutputChannel(
        "AI Commit Generator"
      );
      outputChannel.clear();
      outputChannel.show(true);

      const apiKey = await context.secrets.get("deepseek.apiKey");
      if (!apiKey) {
        vscode.window.showErrorMessage(
          "DeepSeek API key not set. Run: AI Commit Generator: Set DeepSeek API Key"
        );
        return;
      }

      // ⬇️ reuse your already-working staged diff string
      const workspaceFolders = vscode.workspace.workspaceFolders;
      if (!workspaceFolders || workspaceFolders.length === 0) {
        vscode.window.showErrorMessage("No workspace folder is open.");
        return;
      }

      const diff = await getStagedDiff(workspaceFolders[0].uri.fsPath);

      if (!diff) {
        vscode.window.showInformationMessage(
          "No staged changes to generate commit message."
        );
        return;
      }

      try {
        const provider = new DeepSeekProvider(apiKey);

        outputChannel.appendLine(
          "🤖 Generating commit message (DeepSeek)...\n"
        );

        const message = await provider.generateCommitMessage({ diff });

        outputChannel.appendLine("=== GENERATED COMMIT MESSAGE ===\n");
        outputChannel.appendLine(message);
      } catch (err: any) {
        outputChannel.appendLine("❌ Failed to generate commit message");
        outputChannel.appendLine(err.message);
      }
    }
  );

  context.subscriptions.push(generateDeepSeekDisposable);

  const setGeminiKeyDisposable = vscode.commands.registerCommand(
    "ai-commit-generator.setGeminiKey",
    async () => {
      const key = await vscode.window.showInputBox({
        prompt: "Enter your Gemini API key",
        password: true,
        ignoreFocusOut: true,
      });

      if (!key) return;

      await context.secrets.store("gemini.apiKey", key);
      vscode.window.showInformationMessage("Gemini API key saved securely.");
    }
  );

  context.subscriptions.push(setGeminiKeyDisposable);

  const generateGeminiDisposable = vscode.commands.registerCommand(
    "ai-commit-generator.generateCommitMessageGemini",
    async () => {
      const outputChannel = vscode.window.createOutputChannel(
        "AI Commit Generator"
      );
      outputChannel.clear();
      outputChannel.show(true);

      const apiKey = await context.secrets.get("gemini.apiKey");
      if (!apiKey) {
        vscode.window.showErrorMessage(
          "Gemini API key not set. Run: AI Commit Generator: Set Gemini API Key"
        );
        return;
      }

      const workspaceFolders = vscode.workspace.workspaceFolders;
      if (!workspaceFolders || workspaceFolders.length === 0) {
        vscode.window.showErrorMessage("No workspace folder is open.");
        return;
      }

      try {
        const diff = await getStagedDiff(workspaceFolders[0].uri.fsPath);

        if (!diff) {
          vscode.window.showInformationMessage(
            "No staged changes to generate commit message."
          );
          return;
        }

        const provider = new GeminiProvider(apiKey);

        outputChannel.appendLine("🤖 Generating commit message (Gemini)...\n");

        const message = await provider.generateCommitMessage({ diff });

        outputChannel.appendLine("=== GENERATED COMMIT MESSAGE ===\n");
        outputChannel.appendLine(message);
      } catch (err: any) {
        outputChannel.appendLine("❌ Failed to generate commit message");
        outputChannel.appendLine(String(err));
      }
    }
  );

  context.subscriptions.push(generateGeminiDisposable);
}

export function deactivate() {}
