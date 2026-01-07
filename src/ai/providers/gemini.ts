import { LLMProvider, GenerateCommitOptions } from "../llm";
import { buildCommitPrompt } from "../prompt";
import { logger } from "../../utils/logger";

export class GeminiProvider implements LLMProvider {
  readonly id = "gemini";

  private client: any;

  constructor(private apiKey: string) {}

  private async getClient() {
    if (!this.client) {
      const mod = await import("@google/genai");
      this.client = new mod.GoogleGenAI({ apiKey: this.apiKey });
    }
    return this.client;
  }

  async getAvailableModels(): Promise<
    Array<{ name: string; displayName: string }>
  > {
    const client = await this.getClient();
    const result = await client.models.list();

    const models = [];
    for await (const model of result) {
      if (model.name && model.supportedActions?.includes("generateContent")) {
        models.push({
          name: model.name,
          displayName: model.displayName || model.name,
        });
      }
    }

    logger.debug(`Available Gemini models: ${models.length}`);
    return models;
  }

  private async selectModel(): Promise<string> {
    const models = await this.getAvailableModels();

    if (models.length === 0) {
      throw new Error("No Gemini models available for this API key.");
    }

    logger.debug(`Auto-selected model: ${models[0].name}`);
    return models[0].name;
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

    const client = await this.getClient();
    const modelId = options.model || (await this.selectModel());

    logger.info(`Using Gemini model: ${modelId}`);

    if (options.summary?.isLarge) {
      logger.info(
        `Processing large changeset: ${options.summary.filesChanged} files`
      );
    }

    logger.debug("Sending request to Gemini API...");

    const result = await client.models.generateContent({
      model: modelId,
      contents: [
        {
          role: "user",
          parts: [{ text: prompt }],
        },
      ],
    });

    const text = result?.text;

    if (!text) {
      throw new Error("Gemini returned empty response.");
    }

    logger.debug("Response received from Gemini");
    return text.trim();
  }
}