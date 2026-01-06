import * as vscode from "vscode";

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

  constructor(private context: vscode.ExtensionContext) {}

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: ConfigItem): vscode.TreeItem {
    const treeItem = new vscode.TreeItem(element.label);
    treeItem.description = element.description;
    treeItem.tooltip = element.value || element.description;

    if (element.command) {
      treeItem.command = {
        command: element.command,
        title: element.label,
      };
    }

    // Make items look clickable
    treeItem.iconPath = new vscode.ThemeIcon(
      element.command === "ai-commit-generator.setProvider"
        ? "symbol-interface"
        : element.command === "ai-commit-generator.setApiKey"
        ? "key"
        : "settings-gear"
    );

    return treeItem;
  }

  async getChildren(element?: ConfigItem): Promise<ConfigItem[]> {
    if (element) {
      return [];
    }

    const config = vscode.workspace.getConfiguration("aiCommitGenerator");
    const provider = config.get<string>("provider") || "gemini";
    const model = config.get<string>("model") || "auto";

    // Check if API key is set
    const apiKey = await this.context.secrets.get(`${provider}-api-key`);
    const apiKeyStatus = apiKey ? "✓ Set" : "✗ Not Set";

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
    ];
  }
}
