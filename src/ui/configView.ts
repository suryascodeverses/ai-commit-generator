import * as vscode from "vscode";
import { logger } from "../utils/logger";

interface ConfigItem {
  label: string;
  description?: string;
  value?: string;
  command?: string;
}

export class ConfigViewProvider implements vscode.TreeDataProvider<ConfigItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<
    ConfigItem | undefined | void
  >();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  constructor(private context: vscode.ExtensionContext) {
    logger.info("ConfigViewProvider initialized");
  }

  refresh(): void {
    logger.debug("Refreshing Config View...");
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: ConfigItem): vscode.TreeItem {
    logger.debug(`Rendering tree item: ${element.label}`);

    const treeItem = new vscode.TreeItem(element.label);
    treeItem.description = element.description;
    treeItem.tooltip = element.value || element.description;

    if (element.command) {
      treeItem.command = {
        command: element.command,
        title: element.label,
      };
    }

    const iconMap: Record<string, string> = {
      "ai-commit-generator.setProvider": "symbol-interface",
      "ai-commit-generator.setApiKey": "key",
      "ai-commit-generator.setModel": "settings-gear",
      "ai-commit-generator.setCommitStyle": "edit",
    };

    treeItem.iconPath = new vscode.ThemeIcon(
      iconMap[element.command || ""] || "settings-gear"
    );

    return treeItem;
  }

  async getChildren(element?: ConfigItem): Promise<ConfigItem[]> {
    if (element) {
      return [];
    }

    logger.debug("Loading configuration items for tree view...");

    const config = vscode.workspace.getConfiguration("aiCommitGenerator");
    const provider = config.get<string>("provider") || "gemini";
    const model = config.get<string>("model") || "auto";
    const commitStyle = config.get<string>("commitStyle") || "concise";
    const maxLength = config.get<number>("maxLength") || 72;

    logger.debug(
      `Current Settings => Provider: ${provider}, Model: ${model}, Style: ${commitStyle}, MaxLength: ${maxLength}`
    );

    const apiKey = await this.context.secrets.get(`${provider}-api-key`);
    const apiKeyStatus = apiKey ? "✓ Set" : "✗ Not Set";

    if (!apiKey) {
      logger.warn(`No API key stored for provider: ${provider}`);
    }

    return [
      {
        label: "Provider",
        description: provider,
        value: provider,
        command: "ai-commit-generator.setProvider",
      },
      {
        label: "API Key",
        description: apiKeyStatus,
        value: apiKeyStatus,
        command: "ai-commit-generator.setApiKey",
      },
      {
        label: "Model",
        description: model,
        value: model,
        command: "ai-commit-generator.setModel",
      },
      {
        label: "Commit Style",
        description: commitStyle,
        value: `${commitStyle} (max ${maxLength} chars)`,
        command: "ai-commit-generator.setCommitStyle",
      },
    ];
  }
}
