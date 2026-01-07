import { LLMProvider, GenerateCommitOptions } from "../llm";
import { buildCommitPrompt } from "../prompt";
import { logger } from "../../utils/logger";

export class ClaudeProvider implements LLMProvider {
  readonly id = "claude";

  constructor(private apiKey: string) {}

  async getAvailableModels(): Promise<
    Array<{ name: string; displayName: string }>
  > {
    const models = [
      { name: "claude-3-5-sonnet-20241022", displayName: "Claude 3.5 Sonnet" },
      { name: "claude-3-5-haiku-20241022", displayName: "Claude 3.5 Haiku" },
      { name: "claude-3-opus-20240229", displayName: "Claude 3 Opus" },
      { name: "claude-3-sonnet-20240229", displayName: "Claude 3 Sonnet" },
      { name: "claude-3-haiku-20240307", displayName: "Claude 3 Haiku" },
    ];

    logger.debug(`Available Claude models: ${models.length}`);
    return models;
  }

  async generateCommitMessage(options: GenerateCommitOptions): Promise<string> {
    const prompt = buildCommitPrompt(
      options.diff,
      {
        style: options.style || "concise",
        maxLength: options.maxLength || 72,
      },
      options.summary
    );

    const model = options.model || "claude-3-5-sonnet-20241022";

    logger.info(`Using Claude model: ${model}`);

    if (options.summary?.isLarge) {
      logger.info(
        `Processing large changeset: ${options.summary.filesChanged} files`
      );
    }

    logger.debug("Sending request to Claude API...");

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens: 500,
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      logger.error("Claude API request failed", error);
      throw new Error(`Claude API error: ${error}`);
    }

    const data: any = await response.json();
    const message = data.content?.[0]?.text;

    if (!message) {
      logger.error("Claude returned empty response");
      throw new Error("Claude returned empty response");
    }

    logger.debug("Response received from Claude");
    return message.trim();
  }
}
