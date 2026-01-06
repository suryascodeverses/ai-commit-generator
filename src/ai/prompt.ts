export function buildCommitPrompt(diff: string): string {
  return `
You are an expert software engineer.

Generate a clear, detailed Git commit message based on the staged changes below.

Rules:
- Use imperative mood (e.g. "Add", "Fix", "Refactor")
- Explain WHAT changed and WHY
- Do not include file diffs in the output
- Do not use markdown

Staged changes:
${diff}
`.trim();
}
