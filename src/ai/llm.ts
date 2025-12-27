export interface GenerateCommitOptions {
  diff: string;
  maxLength?: number;
}

export interface LLMProvider {
  readonly id: string;
  generateCommitMessage(options: GenerateCommitOptions): Promise<string>;
}
