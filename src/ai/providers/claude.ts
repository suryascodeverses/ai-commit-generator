import { LLMProvider, GenerateCommitOptions } from "../llm";
import { buildCommitPrompt } from "../prompt";

export class ClaudeProvider implements LLMProvider {
  readonly id = "claude";

  constructor(private apiKey: string) {}

  async getAvailableModels(): Promise<
    Array<{ name: string; displayName: string }>
  > {
    // Claude has fixed models
    const models = [
      { name: "claude-3-5-sonnet-20241022", displayName: "Claude 3.5 Sonnet" },
      { name: "claude-3-5-haiku-20241022", displayName: "Claude 3.5 Haiku" },
      { name: "claude-3-opus-20240229", displayName: "Claude 3 Opus" },
      { name: "claude-3-sonnet-20240229", displayName: "Claude 3 Sonnet" },
      { name: "claude-3-haiku-20240307", displayName: "Claude 3 Haiku" },
    ];

    console.log("📋 Available Claude models:", models);
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

    console.log("🤖 Using model:", model);
    console.log("✍️  Commit style:", options.style || "concise");

    if (options.summary?.isLarge) {
      console.log("⚡ Large changeset detected - using smart summary");
      console.log(
        `📊 ${options.summary.filesChanged} files, +${options.summary.insertions}/-${options.summary.deletions}`
      );
    }

    console.log("📤 Sending prompt to Claude...");

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
      throw new Error(`Claude API error: ${error}`);
    }

    const data: any = await response.json();
    const message = data.content?.[0]?.text;

    if (!message) {
      throw new Error("Claude returned empty response");
    }

    console.log("✅ Response received from Claude");
    console.log("📝 Generated message:", message.trim());

    return message.trim();
  }
}