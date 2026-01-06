import { LLMProvider, GenerateCommitOptions } from "../llm";
import { buildCommitPrompt } from "../prompt";

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

    console.log("📋 Available Gemini models:", models);
    return models;
  }

  private async selectModel(): Promise<string> {
    const models = await this.getAvailableModels();

    if (models.length === 0) {
      throw new Error("No Gemini models available for this API key.");
    }

    console.log("✅ Auto-selected model:", models[0].name);
    return models[0].name;
  }

  async generateCommitMessage(options: GenerateCommitOptions): Promise<string> {
    const prompt = buildCommitPrompt(options.diff, {
      style: options.style || "concise",
      maxLength: options.maxLength || 72,
    });

    const client = await this.getClient();
    const modelId = options.model || (await this.selectModel());

    console.log("🤖 Using model:", modelId);
    console.log("✍️  Commit style:", options.style || "concise");
    console.log("📤 Sending prompt to Gemini...");

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

    console.log("✅ Response received from Gemini");
    console.log("📝 Generated message:", text.trim());

    return text.trim();
  }
}