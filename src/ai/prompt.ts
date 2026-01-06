export interface PromptOptions {
  style?: "concise" | "detailed" | "conventional";
  maxLength?: number;
}

export function buildCommitPrompt(
  diff: string,
  options?: PromptOptions
): string {
  const style = options?.style || "concise";
  const maxLength = options?.maxLength || 72;

  const stylePrompts = {
    concise: `
You are a Git commit message generator. Create a SHORT, single-line commit message.

RULES:
- Maximum ${maxLength} characters
- Use imperative mood: "Add", "Fix", "Update", "Remove"
- Be specific about what changed
- NO explanations, NO extra text
- Output ONLY the commit message

EXAMPLES:
- Add user login validation
- Fix null pointer in payment handler
- Update API response format
- Remove deprecated config options

Staged changes:
${diff}

Output ONLY the commit message:`,

    conventional: `
You are a Git commit message generator. Create a conventional commit message.

RULES:
- Start with type: feat:, fix:, refactor:, docs:, style:, test:, chore:
- Maximum ${maxLength} characters total
- Use imperative mood
- Be specific about what changed
- NO explanations beyond the commit line

EXAMPLES:
- feat: Add OAuth2 authentication
- fix: Resolve memory leak in cache
- refactor: Extract validation to utils
- docs: Update installation guide

Staged changes:
${diff}

Output ONLY the commit message:`,

    detailed: `
You are a Git commit message generator. Create a detailed commit message.

RULES:
- First line: brief summary (max 72 chars)
- Second line: empty
- Following lines: detailed explanation
- Use imperative mood
- Explain WHAT and WHY

EXAMPLE:
Add user authentication middleware

Implements JWT-based authentication to secure API endpoints.
This adds login/logout handlers and token verification middleware.

Staged changes:
${diff}

Output the commit message:`,
  };

  return stylePrompts[style].trim();
}

// Backward compatibility
export { buildCommitPrompt as default };
