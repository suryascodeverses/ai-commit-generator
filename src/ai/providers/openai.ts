import { LLMProvider, GenerateCommitOptions } from "../llm";
import { buildCommitPrompt } from "../prompt";

export class OpenAIProvider implements LLMProvider {
  readonly id = "openai";

  constructor(private apiKey: string) {}

  async getAvailableModels(): Promise<
    Array<{ name: string; displayName: string }>
  > {
    try {
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

      // Filter for GPT models only
      const gptModels = data.data
        .filter((m: any) => m.id.includes("gpt"))
        .map((m: any) => ({
          name: m.id,
          displayName: m.id,
        }));

      console.log("📋 Available OpenAI models:", gptModels);
      return gptModels;
    } catch (error: any) {
      console.error("Failed to fetch OpenAI models:", error);
      // Return default models as fallback
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

    console.log("🤖 Using model:", model);
    console.log("✍️  Commit style:", options.style || "concise");

    if (options.summary?.isLarge) {
      console.log("⚡ Large changeset detected - using smart summary");
      console.log(
        `📊 ${options.summary.filesChanged} files, +${options.summary.insertions}/-${options.summary.deletions}`
      );
    }

    console.log("📤 Sending prompt to OpenAI...");

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
      throw new Error(`OpenAI API error: ${error}`);
    }

    const data: any = await response.json();
    const message = data.choices?.[0]?.message?.content;

    if (!message) {
      throw new Error("OpenAI returned empty response");
    }

    console.log("✅ Response received from OpenAI");
    console.log("📝 Generated message:", message.trim());

    return message.trim();
  }
}