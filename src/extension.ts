import * as vscode from "vscode";
import { ConfigViewProvider } from "./ui/configView";
import { GeminiProvider } from "./ai/providers/gemini";
import { OpenAIProvider } from "./ai/providers/openai";
import { DeepSeekProvider } from "./ai/providers/deepseek";
import { ClaudeProvider } from "./ai/providers/claude";
import { LLMProvider } from "./ai/llm";
import { processDiff, truncateDiff } from "./ai/diffProcessor";

let configViewProvider: ConfigViewProvider;

export function activate(context: vscode.ExtensionContext) {
  console.log("AI Commit Generator is now active!");

  // Register config view
  configViewProvider = new ConfigViewProvider(context);
  vscode.window.registerTreeDataProvider("aiCommitConfig", configViewProvider);

  // Register commands
  context.subscriptions.push(
    vscode.commands.registerCommand("ai-commit-generator.generateCommit", () =>
      generateCommitMessage(context)
    ),
    vscode.commands.registerCommand("ai-commit-generator.openConfig", () => {
      vscode.commands.executeCommand(
        "workbench.view.extension.ai-commit-container"
      );
    }),
    vscode.commands.registerCommand("ai-commit-generator.setProvider", () =>
      setProvider(context)
    ),
    vscode.commands.registerCommand("ai-commit-generator.setApiKey", () =>
      setApiKey(context)
    ),
    vscode.commands.registerCommand("ai-commit-generator.setModel", () =>
      setModel(context)
    ),
    vscode.commands.registerCommand("ai-commit-generator.setCommitStyle", () =>
      setCommitStyle(context)
    )
  );
}

async function generateCommitMessage(context: vscode.ExtensionContext) {
  const outputChannel = vscode.window.createOutputChannel(
    "AI Commit Generator"
  );
  outputChannel.show();

  try {
    const config = vscode.workspace.getConfiguration("aiCommitGenerator");
    const provider = config.get<string>("provider") || "gemini";
    const model = config.get<string>("model") || "auto-select";
    const commitStyle = config.get<string>("commitStyle") || "concise";
    const maxLength = config.get<number>("maxLength") || 72;

    outputChannel.appendLine("=".repeat(60));
    outputChannel.appendLine("🚀 AI Commit Generator");
    outputChannel.appendLine("=".repeat(60));
    outputChannel.appendLine(`📍 Provider: ${provider}`);
    outputChannel.appendLine(`🤖 Model: ${model || "auto-select"}`);
    outputChannel.appendLine(`✍️  Style: ${commitStyle}`);
    outputChannel.appendLine(`📏 Max Length: ${maxLength}`);
    outputChannel.appendLine("");

    // Get API key
    const apiKey = await context.secrets.get(`${provider}-api-key`);
    if (!apiKey) {
      const errorMsg = `No API key found for ${provider}. Please set it first.`;
      outputChannel.appendLine(`❌ Error: ${errorMsg}`);

      const action = await vscode.window.showErrorMessage(
        errorMsg,
        "Set API Key"
      );
      if (action === "Set API Key") {
        await setApiKey(context);
      }
      return;
    }

    // Get git extension
    const gitExtension = vscode.extensions.getExtension("vscode.git");
    if (!gitExtension) {
      outputChannel.appendLine("❌ Error: Git extension not found");
      vscode.window.showErrorMessage("Git extension not found");
      return;
    }

    const git = gitExtension.exports.getAPI(1);
    const repo = git.repositories[0];

    if (!repo) {
      outputChannel.appendLine("❌ Error: No Git repository found");
      vscode.window.showErrorMessage("No Git repository found");
      return;
    }

    // Get staged changes
    outputChannel.appendLine("📦 Fetching staged changes...");
    const diff = await repo.diff(true);
    if (!diff || diff.trim().length === 0) {
      outputChannel.appendLine("⚠️  Warning: No staged changes found");
      vscode.window.showWarningMessage("No staged changes found");
      return;
    }

    // Process diff intelligently
    const diffSummary = processDiff(diff);

    outputChannel.appendLine(`📊 Changes detected:`);
    outputChannel.appendLine(`   Files: ${diffSummary.filesChanged}`);
    outputChannel.appendLine(`   Insertions: +${diffSummary.insertions}`);
    outputChannel.appendLine(`   Deletions: -${diffSummary.deletions}`);
    outputChannel.appendLine(
      `   Large changeset: ${diffSummary.isLarge ? "Yes" : "No"}`
    );

    if (diffSummary.isLarge) {
      outputChannel.appendLine("");
      outputChannel.appendLine(
        "⚡ Using smart diff summary (large changeset detected)"
      );
      outputChannel.appendLine(`📝 Summary:\n${diffSummary.summary}`);
    }

    // Truncate diff if too large
    const processedDiff = diffSummary.isLarge ? truncateDiff(diff, 100) : diff;

    outputChannel.appendLine("");
    outputChannel.appendLine("🔄 Generating commit message...");

    // Show progress
    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: `Generating commit message with ${provider}...`,
        cancellable: false,
      },
      async () => {
        // Get provider instance
        const llmProvider = getProvider(provider, apiKey);

        // Generate commit message with smart processing
        const message = await llmProvider.generateCommitMessage({
          diff: processedDiff,
          model: model || undefined,
          style: commitStyle as any,
          maxLength,
          summary: diffSummary,
        });

        outputChannel.appendLine("");
        outputChannel.appendLine("=".repeat(60));
        outputChannel.appendLine("✅ GENERATED COMMIT MESSAGE:");
        outputChannel.appendLine("=".repeat(60));
        outputChannel.appendLine(message);
        outputChannel.appendLine("=".repeat(60));
        outputChannel.appendLine("");
        outputChannel.appendLine(`📊 Length: ${message.length} characters`);

        // Set commit message in source control input box
        repo.inputBox.value = message;

        vscode.window.showInformationMessage(
          "✓ Commit message generated successfully!"
        );
      }
    );
  } catch (error: any) {
    outputChannel.appendLine("");
    outputChannel.appendLine("❌ ERROR:");
    outputChannel.appendLine(error.message);
    outputChannel.appendLine("");

    // Better error messages for common issues
    if (error.message.includes("quota") || error.message.includes("429")) {
      outputChannel.appendLine("💡 TIP: Rate limit exceeded. Try:");
      outputChannel.appendLine("   1. Wait a minute and try again");
      outputChannel.appendLine("   2. Use a different model");
      outputChannel.appendLine("   3. Switch to a different provider");
    }

    if (error.stack) {
      outputChannel.appendLine("");
      outputChannel.appendLine("Stack trace:");
      outputChannel.appendLine(error.stack);
    }

    vscode.window.showErrorMessage(
      `Failed to generate commit message: ${error.message}`
    );
  }
}

async function setProvider(context: vscode.ExtensionContext) {
  const providers = [
    { label: "Gemini", value: "gemini" },
    { label: "OpenAI", value: "openai" },
    { label: "DeepSeek", value: "deepseek" },
    { label: "Claude", value: "claude" },
  ];

  const selected = await vscode.window.showQuickPick(providers, {
    placeHolder: "Select AI provider",
  });

  if (selected) {
    const config = vscode.workspace.getConfiguration("aiCommitGenerator");
    await config.update("provider", selected.value, true);
    configViewProvider.refresh();
    vscode.window.showInformationMessage(`Provider set to ${selected.label}`);
  }
}

async function setApiKey(context: vscode.ExtensionContext) {
  const config = vscode.workspace.getConfiguration("aiCommitGenerator");
  const provider = config.get<string>("provider") || "gemini";

  const apiKey = await vscode.window.showInputBox({
    prompt: `Enter your ${provider} API key`,
    password: true,
    placeHolder: "API key will be stored securely",
  });

  if (apiKey) {
    await context.secrets.store(`${provider}-api-key`, apiKey);
    configViewProvider.refresh();
    vscode.window.showInformationMessage(`${provider} API key saved securely`);
  }
}

async function setModel(context: vscode.ExtensionContext) {
  const config = vscode.workspace.getConfiguration("aiCommitGenerator");
  const provider = config.get<string>("provider") || "gemini";

  // Get API key to fetch available models
  const apiKey = await context.secrets.get(`${provider}-api-key`);
  if (!apiKey) {
    vscode.window.showErrorMessage(
      `Please set ${provider} API key first before selecting a model.`
    );
    return;
  }

  let models: { label: string; value: string }[] = [];

  try {
    // Show loading
    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: `Fetching available ${provider} models...`,
        cancellable: false,
      },
      async () => {
        const llmProvider = getProvider(provider, apiKey);

        // Fetch models dynamically if provider supports it
        if (provider === "gemini" && "getAvailableModels" in llmProvider) {
          const geminiModels = await (llmProvider as any).getAvailableModels();
          models = [
            { label: "Auto-select (Recommended)", value: "" },
            ...geminiModels.map((m: any) => ({
              label: m.displayName || m.name,
              value: m.name,
            })),
          ];
        } else {
          // Fallback to predefined models for other providers
          switch (provider) {
            case "openai":
              models = [
                { label: "GPT-4", value: "gpt-4" },
                { label: "GPT-4 Turbo", value: "gpt-4-turbo-preview" },
                { label: "GPT-3.5 Turbo", value: "gpt-3.5-turbo" },
              ];
              break;
            case "deepseek":
              models = [
                { label: "DeepSeek Chat", value: "deepseek-chat" },
                { label: "DeepSeek Coder", value: "deepseek-coder" },
              ];
              break;
            case "claude":
              models = [
                {
                  label: "Claude 3.5 Sonnet",
                  value: "claude-3-5-sonnet-20241022",
                },
                { label: "Claude 3 Opus", value: "claude-3-opus-20240229" },
                { label: "Claude 3 Haiku", value: "claude-3-haiku-20240307" },
              ];
              break;
          }
        }
      }
    );

    if (models.length === 0) {
      vscode.window.showErrorMessage(
        `No models found for ${provider}. Please check your API key.`
      );
      return;
    }

    const selected = await vscode.window.showQuickPick(models, {
      placeHolder: `Select model for ${provider}`,
    });

    if (selected !== undefined) {
      await config.update("model", selected.value, true);
      configViewProvider.refresh();

      // Show output channel with selection
      const outputChannel = vscode.window.createOutputChannel(
        "AI Commit Generator"
      );
      outputChannel.appendLine(`✅ Model set to: ${selected.label}`);
      outputChannel.appendLine(`   Provider: ${provider}`);
      outputChannel.appendLine(
        `   Model ID: ${selected.value || "auto-select"}`
      );
      outputChannel.show();

      vscode.window.showInformationMessage(
        selected.value
          ? `Model set to ${selected.label}`
          : "Model set to auto-select"
      );
    }
  } catch (error: any) {
    vscode.window.showErrorMessage(`Failed to fetch models: ${error.message}`);
  }
}

// async function setModel(context: vscode.ExtensionContext) {
//   const config = vscode.workspace.getConfiguration("aiCommitGenerator");
//   const provider = config.get<string>("provider") || "gemini";

//   let models: { label: string; value: string }[] = [];

//   // Define available models per provider
//   switch (provider) {
//     case "gemini":
//       models = [
//         { label: "Auto-select (Recommended)", value: "" },
//         { label: "Gemini 2.0 Flash", value: "gemini-2.0-flash-exp" },
//         { label: "Gemini 1.5 Pro", value: "gemini-1.5-pro" },
//         { label: "Gemini 1.5 Flash", value: "gemini-1.5-flash" },
//       ];
//       break;
//     case "openai":
//       models = [
//         { label: "GPT-4", value: "gpt-4" },
//         { label: "GPT-4 Turbo", value: "gpt-4-turbo-preview" },
//         { label: "GPT-3.5 Turbo", value: "gpt-3.5-turbo" },
//       ];
//       break;
//     case "deepseek":
//       models = [
//         { label: "DeepSeek Chat", value: "deepseek-chat" },
//         { label: "DeepSeek Coder", value: "deepseek-coder" },
//       ];
//       break;
//     case "claude":
//       models = [
//         { label: "Claude 3.5 Sonnet", value: "claude-3-5-sonnet-20241022" },
//         { label: "Claude 3 Opus", value: "claude-3-opus-20240229" },
//         { label: "Claude 3 Haiku", value: "claude-3-haiku-20240307" },
//       ];
//       break;
//   }

//   const selected = await vscode.window.showQuickPick(models, {
//     placeHolder: `Select model for ${provider}`,
//   });

//   if (selected !== undefined) {
//     await config.update("model", selected.value, true);
//     configViewProvider.refresh();
//     vscode.window.showInformationMessage(
//       selected.value
//         ? `Model set to ${selected.label}`
//         : "Model set to auto-select"
//     );
//   }
// }

function getProvider(provider: string, apiKey: string): LLMProvider {
  switch (provider) {
    case "gemini":
      return new GeminiProvider(apiKey);
    case "openai":
      return new OpenAIProvider(apiKey);
    case "deepseek":
      return new DeepSeekProvider(apiKey);
    case "claude":
      return new ClaudeProvider(apiKey);
    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
}

export function deactivate() {}

async function setCommitStyle(context: vscode.ExtensionContext) {
  const styles = [
    {
      label: "GitHub Copilot Style",
      description:
        "Natural language: Add, Update, Fix, Remove... (no prefixes)",
      value: "concise",
      detail:
        "Example: Add README and initial text file for project documentation",
    },
    {
      label: "Conventional Commits",
      description: "With type prefixes: feat:, fix:, docs:, style:, etc.",
      value: "conventional",
      detail: "Example: feat: Add user authentication module",
    },
    {
      label: "Detailed Commits",
      description: "Multi-line with bullet points explaining changes",
      value: "detailed",
      detail: "Example: Add user auth\n\n- Implement JWT\n- Add endpoints",
    },
  ];

  const selected = await vscode.window.showQuickPick(styles, {
    placeHolder: "Select commit message style",
    matchOnDescription: true,
    matchOnDetail: true,
  });

  if (selected) {
    const config = vscode.workspace.getConfiguration("aiCommitGenerator");
    await config.update("commitStyle", selected.value, true);

    // Ask for max length if needed
    if (selected.value !== "detailed") {
      const maxLength = await vscode.window.showInputBox({
        prompt: "Maximum commit message length",
        value: "72",
        validateInput: (value) => {
          const num = parseInt(value);
          if (isNaN(num) || num < 50 || num > 200) {
            return "Enter a number between 50 and 200";
          }
          return null;
        },
      });

      if (maxLength) {
        await config.update("maxLength", parseInt(maxLength), true);
      }
    }

    configViewProvider.refresh();
    vscode.window.showInformationMessage(
      `Commit style set to ${selected.label}`
    );
  }
}
