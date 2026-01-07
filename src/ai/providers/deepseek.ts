import { LLMProvider, GenerateCommitOptions } from "../llm";
import { buildCommitPrompt } from "../prompt";
import { logger } from "../../utils/logger";

export class DeepSeekProvider implements LLMProvider {
  readonly id = "deepseek";

  constructor(private apiKey: string) {}

  async getAvailableModels(): Promise<
    Array<{ name: string; displayName: string }>
  > {
    const models = [
      { name: "deepseek-chat", displayName: "DeepSeek Chat" },
      { name: "deepseek-coder", displayName: "DeepSeek Coder" },
    ];

    logger.debug(`Available DeepSeek models: ${models.length}`);
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

    const model = options.model || "deepseek-chat";

    logger.info(`Using DeepSeek model: ${model}`);

    if (options.summary?.isLarge) {
      logger.info(
        `Processing large changeset: ${options.summary.filesChanged} files`
      );
    }

    logger.debug("Sending request to DeepSeek API...");

    const response = await fetch(
      "https://api.deepseek.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            {
              role: "user",
              content: prompt,
            },
          ],
          temperature: 0.7,
          max_tokens: 500,
        }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      logger.error("DeepSeek API request failed", error);
      throw new Error(`DeepSeek API error: ${error}`);
    }

    const data: any = await response.json();
    const message = data.choices?.[0]?.message?.content;

    if (!message) {
      logger.error("DeepSeek returned empty response");
      throw new Error("DeepSeek returned empty response");
    }

    logger.debug("Response received from DeepSeek");
    return message.trim();
  }
}
