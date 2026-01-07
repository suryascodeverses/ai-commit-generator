import { LLMProvider, GenerateCommitOptions } from "../llm";
import { buildCommitPrompt } from "../prompt";
import { logger } from "../../utils/logger";

export class OpenAIProvider implements LLMProvider {
  readonly id = "openai";

  constructor(private apiKey: string) {}

  async getAvailableModels(): Promise<
    Array<{ name: string; displayName: string }>
  > {
    try {
      logger.debug("Fetching OpenAI models...");

      const response = await fetch("https://api.openai.com/v1/models", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch models: ${response.statusText}`);
      }

      const data: any = await response.json();

      const gptModels = data.data
        .filter((m: any) => m.id.includes("gpt"))
        .map((m: any) => ({
          name: m.id,
          displayName: m.id,
        }));

      logger.debug(`Available OpenAI models: ${gptModels.length}`);
      return gptModels;
    } catch (error: any) {
      logger.error("Failed to fetch OpenAI models, using fallback list", error);

      return [
        { name: "gpt-4o", displayName: "GPT-4o" },
        { name: "gpt-4o-mini", displayName: "GPT-4o Mini" },
        { name: "gpt-4-turbo", displayName: "GPT-4 Turbo" },
        { name: "gpt-3.5-turbo", displayName: "GPT-3.5 Turbo" },
      ];
    }
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

    const model = options.model || "gpt-4o-mini";

    logger.info(`Using OpenAI model: ${model}`);

    if (options.summary?.isLarge) {
      logger.info(
        `Processing large changeset: ${options.summary.filesChanged} files`
      );
    }

    logger.debug("Sending request to OpenAI API...");

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
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
    });

    if (!response.ok) {
      const error = await response.text();
      logger.error("OpenAI API request failed", error);
      throw new Error(`OpenAI API error: ${error}`);
    }

    const data: any = await response.json();
    const message = data.choices?.[0]?.message?.content;

    if (!message) {
      logger.error("OpenAI returned empty response");
      throw new Error("OpenAI returned empty response");
    }

    logger.debug("Response received from OpenAI");
    return message.trim();
  }
}
