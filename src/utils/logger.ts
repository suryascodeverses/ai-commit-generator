import * as vscode from "vscode";

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

export class Logger {
  private static instance: Logger;
  private outputChannel: vscode.OutputChannel;
  private logLevel: LogLevel = LogLevel.INFO;

  private constructor() {
    this.outputChannel = vscode.window.createOutputChannel(
      "AI Commit Generator"
    );
  }

  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  setLogLevel(level: LogLevel): void {
    this.logLevel = level;
  }

  show(): void {
    this.outputChannel.show();
  }

  hide(): void {
    this.outputChannel.hide();
  }

  clear(): void {
    this.outputChannel.clear();
  }

  debug(message: string, ...args: any[]): void {
    if (this.logLevel <= LogLevel.DEBUG) {
      const formatted = this.format("DEBUG", message, args);
      this.outputChannel.appendLine(formatted);
      console.debug(formatted, ...args);
    }
  }

  info(message: string, ...args: any[]): void {
    if (this.logLevel <= LogLevel.INFO) {
      const formatted = this.format("INFO", message, args);
      this.outputChannel.appendLine(formatted);
      console.log(formatted, ...args);
    }
  }

  warn(message: string, ...args: any[]): void {
    if (this.logLevel <= LogLevel.WARN) {
      const formatted = this.format("WARN", message, args);
      this.outputChannel.appendLine(formatted);
      console.warn(formatted, ...args);
    }
  }

  error(message: string, error?: Error | any): void {
    if (this.logLevel <= LogLevel.ERROR) {
      const formatted = this.format("ERROR", message);
      this.outputChannel.appendLine(formatted);

      if (error) {
        if (error instanceof Error) {
          this.outputChannel.appendLine(`  ${error.message}`);
          if (error.stack) {
            this.outputChannel.appendLine(`  Stack: ${error.stack}`);
          }
        } else {
          this.outputChannel.appendLine(`  ${JSON.stringify(error, null, 2)}`);
        }
      }

      console.error(formatted, error);
    }
  }

  header(message: string): void {
    const separator = "=".repeat(60);
    this.outputChannel.appendLine("");
    this.outputChannel.appendLine(separator);
    this.outputChannel.appendLine(`  ${message}`);
    this.outputChannel.appendLine(separator);
  }

  log(prefix: string, message: string): void {
    this.outputChannel.appendLine(`${prefix} ${message}`);
  }

  private format(level: string, message: string, args?: any[]): string {
    const timestamp = new Date().toISOString().split("T")[1].split(".")[0];
    const argsStr = args && args.length > 0 ? ` ${JSON.stringify(args)}` : "";
    return `[${timestamp}] [${level}] ${message}${argsStr}`;
  }

  dispose(): void {
    this.outputChannel.dispose();
  }
}

// Export singleton instance for easy access
export const logger = Logger.getInstance();
