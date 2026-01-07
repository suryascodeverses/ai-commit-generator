import { DiffSummary } from "./diffProcessor";

export interface PromptOptions {
  style?: "concise" | "detailed" | "conventional";
  maxLength?: number;
}

export function buildCommitPrompt(
  diff: string,
  options?: PromptOptions,
  summary?: DiffSummary
): string {
  const style = options?.style || "concise";
  const maxLength = options?.maxLength || 72;

  // Build context from summary if available
  let contextInfo = "";
  if (summary) {
    const added = summary.files.filter((f) => f.status === "added");
    const deleted = summary.files.filter((f) => f.status === "deleted");
    const modified = summary.files.filter((f) => f.status === "modified");
    const formatting = summary.files.filter((f) => f.isFormatting);

    contextInfo = `
Context:
- ${added.length} file(s) added: ${
      added.map((f) => f.path).join(", ") || "none"
    }
- ${modified.length} file(s) modified: ${
      modified.map((f) => f.path).join(", ") || "none"
    }
- ${deleted.length} file(s) deleted: ${
      deleted.map((f) => f.path).join(", ") || "none"
    }
- ${formatting.length} file(s) reformatted: ${
      formatting.map((f) => f.path).join(", ") || "none"
    }
`;
  }

  const changeDescription = summary?.isLarge
    ? `${contextInfo}\n\nDiff sample (truncated):\n${diff}`
    : `${contextInfo}\n\nFull diff:\n${diff}`;

  const stylePrompts = {
    concise: `You are analyzing git changes to write a commit message like GitHub Copilot does.

STRICT RULES:
1. Analyze the ACTUAL changes in the diff - don't make things up
2. Maximum ${maxLength} characters
3. Format: "Action files/feature description"
4. Use these action words based on what actually happened:
   - "Add" for new files/features
   - "Update" for modifications
   - "Remove" or "Delete" for deletions
   - "Fix" for bug fixes
   - "Refactor" for code restructuring
   - "Format" for formatting changes only
5. Be SPECIFIC about what files/features changed
6. NO prefixes like "feat:", "fix:" etc
7. Output ONLY the commit message, nothing else

REAL EXAMPLES from GitHub Copilot:
- "Add README and initial text file for project documentation"
- "Update user authentication logic in auth.ts"
- "Remove deprecated config files"
- "Fix null pointer exception in payment handler"
- "Format code with prettier"

ANALYZE THE CHANGES:
${changeDescription}

Based ONLY on what you see in the diff above, write the commit message:`,

    conventional: `You are analyzing git changes to write a conventional commit message.

STRICT RULES:
1. Analyze the ACTUAL changes in the diff - don't make things up
2. Format: "type: description"
3. Types: feat, fix, docs, style, refactor, test, chore
4. Maximum ${maxLength} characters total
5. Be SPECIFIC about what changed
6. Output ONLY the commit message

EXAMPLES:
- "feat: Add user authentication module"
- "fix: Resolve null pointer in payment handler"
- "docs: Add README with setup instructions"
- "style: Format code with prettier"
- "refactor: Extract validation logic"
- "chore: Update dependencies"

ANALYZE THE CHANGES:
${changeDescription}

Based ONLY on what you see in the diff above, write the commit message:`,

    detailed: `You are analyzing git changes to write a detailed commit message.

RULES:
1. First line: brief summary (max 72 chars)
2. Second line: empty
3. Following lines: bullet points explaining changes
4. Be SPECIFIC about what changed
5. Use imperative mood

EXAMPLE:
Add user authentication system

- Implement JWT-based authentication
- Add login and logout endpoints
- Create middleware for token verification

ANALYZE THE CHANGES:
${changeDescription}

Based ONLY on what you see in the diff above, write the commit message:`,
  };

  return stylePrompts[style].trim();
}