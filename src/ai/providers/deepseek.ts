import { LLMProvider, GenerateCommitOptions } from "../llm";
import { buildCommitPrompt } from "../prompt";

export class DeepSeekProvider implements LLMProvider {
  readonly id = "deepseek";

  constructor(private apiKey: string) {}

  async getAvailableModels(): Promise<
    Array<{ name: string; displayName: string }>
  > {
    // DeepSeek has fixed models
    const models = [
      { name: "deepseek-chat", displayName: "DeepSeek Chat" },
      { name: "deepseek-coder", displayName: "DeepSeek Coder" },
    ];

    console.log("📋 Available DeepSeek models:", models);
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

    console.log("🤖 Using model:", model);
    console.log("✍️  Commit style:", options.style || "concise");

    if (options.summary?.isLarge) {
      console.log("⚡ Large changeset detected - using smart summary");
      console.log(
        `📊 ${options.summary.filesChanged} files, +${options.summary.insertions}/-${options.summary.deletions}`
      );
    }

    console.log("📤 Sending prompt to DeepSeek...");

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
      throw new Error(`DeepSeek API error: ${error}`);
    }

    const data: any = await response.json();
    const message = data.choices?.[0]?.message?.content;

    if (!message) {
      throw new Error("DeepSeek returned empty response");
    }

    console.log("✅ Response received from DeepSeek");
    console.log("📝 Generated message:", message.trim());

    return message.trim();
  }
}