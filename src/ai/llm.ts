export interface GenerateCommitOptions {
  diff: string;
  maxLength?: number;
  model?: string;
  style?: "concise" | "detailed" | "conventional";
}

export interface LLMProvider {
  readonly id: string;
  generateCommitMessage(options: GenerateCommitOptions): Promise<string>;
  getAvailableModels?(): Promise<Array<{ name: string; displayName: string }>>;
}
