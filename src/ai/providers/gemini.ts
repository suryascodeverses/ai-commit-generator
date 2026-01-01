import { LLMProvider, GenerateCommitOptions } from "../llm";
import { buildCommitPrompt } from "../prompt";

/**
 * Gemini provider using official @google/genai SDK
 * Compatible with CommonJS (VS Code extensions)
 */
export class GeminiProvider implements LLMProvider {
  readonly id = "gemini";

  private client: any; // SDK is loaded dynamically (ESM)

  constructor(private apiKey: string) {}

  /** Lazy-load ESM-only SDK */
  private async getClient() {
    if (!this.client) {
      const mod = await import("@google/genai");
      this.client = new mod.GoogleGenAI({ apiKey: this.apiKey });
    }
    return this.client;
  }

  /** Select first model that supports generateContent */
  private async selectModel(): Promise<string> {
    const client = await this.getClient();

    const result = await client.models.list();

    const models = [];

    // The Pager automatically fetches next pages as you iterate
    for await (const model of result) {
      models.push(model);
      console.log(model.name);
    }

    const usable = models.find(
      (m: { name?: string; supportedGenerationMethods?: string[] }) =>
        m.name && m.supportedGenerationMethods?.includes("generateContent")
    );

    if (!usable?.name) {
      throw new Error("No Gemini models available for this API key.");
    }

    return usable.name;
  }

  async generateCommitMessage(options: GenerateCommitOptions): Promise<string> {
    const prompt = buildCommitPrompt(options.diff);
    const client = await this.getClient();
    const modelId = await this.selectModel();

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

    return text.trim();
  }
}
