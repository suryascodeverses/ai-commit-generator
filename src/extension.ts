import * as vscode from "vscode";
import { ConfigViewProvider } from "./ui/configView";
import { GeminiProvider } from "./ai/providers/gemini";
import { OpenAIProvider } from "./ai/providers/openai";
import { DeepSeekProvider } from "./ai/providers/deepseek";
import { ClaudeProvider } from "./ai/providers/claude";
import { LLMProvider } from "./ai/llm";
import { processDiff, truncateDiff } from "./ai/diffProcessor";
import { logger, LogLevel } from "./utils/logger";

let configViewProvider: ConfigViewProvider;

export function activate(context: vscode.ExtensionContext) {
  logger.info("Activating AI Commit Generator...");

  const isDev = context.extensionMode === vscode.ExtensionMode.Development;
  logger.setLogLevel(isDev ? LogLevel.DEBUG : LogLevel.INFO);

  configViewProvider = new ConfigViewProvider(context);
  vscode.window.registerTreeDataProvider("aiCommitConfig", configViewProvider);

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

  context.subscriptions.push({ dispose: () => logger.dispose() });

  logger.info("AI Commit Generator activated");
}

async function generateCommitMessage(context: vscode.ExtensionContext) {
  logger.clear();
  logger.show();

  try {
    const config = vscode.workspace.getConfiguration("aiCommitGenerator");
    const provider = config.get<string>("provider") || "gemini";
    const model = config.get<string>("model") || "auto-select";
    const commitStyle = config.get<string>("commitStyle") || "concise";
    const maxLength = config.get<number>("maxLength") || 72;

    logger.header("AI Commit Generator");
    logger.info(`Provider: ${provider}`);
    logger.info(`Model: ${model || "auto-select"}`);
    logger.info(`Style: ${commitStyle}`);
    logger.info(`Max Length: ${maxLength}`);

    let apiKey = "";
    if (provider !== "mock") {
      apiKey = (await context.secrets.get(`${provider}-api-key`)) || "";
      if (!apiKey) {
        const msg = `No API key found for ${provider}.`;
        logger.error(msg);
        const action = await vscode.window.showErrorMessage(
          `${msg} Please set it.`,
          "Set API Key"
        );
        if (action === "Set API Key") await setApiKey(context);
        return;
      }
      logger.debug("API key loaded");
    } else {
      logger.info("Using Mock Provider");
    }

    const gitExtension = vscode.extensions.getExtension("vscode.git");
    if (!gitExtension) {
      logger.error("Git extension not found");
      vscode.window.showErrorMessage("Git extension not found");
      return;
    }

    const git = gitExtension.exports.getAPI(1);
    const repo = git.repositories[0];
    if (!repo) {
      logger.error("No Git repository detected");
      vscode.window.showErrorMessage("No Git repository detected");
      return;
    }

    logger.info("Fetching staged changes...");
    const diff = await repo.diff(true);

    if (!diff || !diff.trim()) {
      logger.warn("No staged changes found");
      vscode.window.showWarningMessage("No staged changes found");
      return;
    }

    const diffSummary = processDiff(diff);

    logger.info(
      `Changes: Files=${diffSummary.filesChanged}, +${diffSummary.insertions} / -${diffSummary.deletions}, Large=${diffSummary.isLarge}`
    );

    if (diffSummary.isLarge) {
      logger.debug(`Large diff summary:\n${diffSummary.summary}`);
    }

    const processedDiff = diffSummary.isLarge ? truncateDiff(diff, 100) : diff;

    logger.info("Generating commit message...");

    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: `Generating commit message using ${provider}...`,
        cancellable: false,
      },
      async () => {
        const llmProvider = getProvider(provider, apiKey);

        const message = await llmProvider.generateCommitMessage({
          diff: processedDiff,
          model: model || undefined,
          style: commitStyle as any,
          maxLength,
          summary: diffSummary,
        });

        logger.header("Generated Commit Message");
        logger.info(message);
        logger.info(`Message length: ${message.length}`);

        repo.inputBox.value = message;

        vscode.window.showInformationMessage(
          "Commit message generated successfully"
        );
      }
    );
  } catch (error: any) {
    logger.error("Commit generation failed", error);

    if (error?.message?.includes("quota") || error?.message?.includes("429")) {
      logger.info("Rate limit detected. Consider changing provider or model.");
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
    logger.info(`Provider changed to ${selected.label}`);
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
    logger.info(`${provider} API key saved`);
    vscode.window.showInformationMessage(`${provider} API key saved securely`);
  }
}

async function setModel(context: vscode.ExtensionContext) {
  const config = vscode.workspace.getConfiguration("aiCommitGenerator");
  const provider = config.get<string>("provider") || "gemini";
  const apiKey = await context.secrets.get(`${provider}-api-key`);

  if (!apiKey) {
    vscode.window.showErrorMessage(
      `Please set ${provider} API key first before selecting a model.`
    );
    return;
  }

  let models: { label: string; value: string }[] = [];

  try {
    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: `Fetching ${provider} models...`,
        cancellable: false,
      },
      async () => {
        const llmProvider = getProvider(provider, apiKey);

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

    if (!models.length) {
      logger.error("No models found");
      vscode.window.showErrorMessage(
        `No models found for ${provider}. Check API key.`
      );
      return;
    }

    const selected = await vscode.window.showQuickPick(models, {
      placeHolder: `Select model for ${provider}`,
    });

    if (selected) {
      await config.update("model", selected.value, true);
      configViewProvider.refresh();

      logger.info(`Model set: ${selected.label}`);
      vscode.window.showInformationMessage(
        selected.value
          ? `Model set to ${selected.label}`
          : "Model set to auto-select"
      );
    }
  } catch (error: any) {
    logger.error("Failed to fetch models", error);
    vscode.window.showErrorMessage(`Failed to fetch models: ${error.message}`);
  }
}

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
