export interface DiffSummary {
  filesChanged: number;
  insertions: number;
  deletions: number;
  files: FileChange[];
  isLarge: boolean;
  summary: string;
}

export interface FileChange {
  path: string;
  status: "added" | "modified" | "deleted" | "renamed";
  additions: number;
  deletions: number;
  isFormatting: boolean;
}

/**
 * Process git diff and create a smart summary
 * This mimics GitHub Copilot's approach of analyzing changes intelligently
 */
export function processDiff(diff: string): DiffSummary {
  const lines = diff.split("\n");
  const files: FileChange[] = [];
  let currentFile: FileChange | null = null;

  let totalInsertions = 0;
  let totalDeletions = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Detect file changes
    if (line.startsWith("diff --git")) {
      if (currentFile) {
        files.push(currentFile);
      }

      // Extract file path
      const match = line.match(/diff --git a\/(.*?) b\/(.*)/);
      const filePath = match ? match[2] : "unknown";

      currentFile = {
        path: filePath,
        status: "modified",
        additions: 0,
        deletions: 0,
        isFormatting: false,
      };
    }

    // Detect new file
    if (line.startsWith("new file mode")) {
      if (currentFile) currentFile.status = "added";
    }

    // Detect deleted file
    if (line.startsWith("deleted file mode")) {
      if (currentFile) currentFile.status = "deleted";
    }

    // Detect renamed file
    if (line.startsWith("rename from")) {
      if (currentFile) currentFile.status = "renamed";
    }

    // Count additions and deletions
    if (line.startsWith("+") && !line.startsWith("+++")) {
      if (currentFile) currentFile.additions++;
      totalInsertions++;
    }

    if (line.startsWith("-") && !line.startsWith("---")) {
      if (currentFile) currentFile.deletions++;
      totalDeletions++;
    }
  }

  if (currentFile) {
    files.push(currentFile);
  }

  // Detect formatting changes (lots of changes but similar add/delete ratio)
  files.forEach((file) => {
    const total = file.additions + file.deletions;
    const ratio = Math.abs(file.additions - file.deletions) / (total || 1);

    // If changes are balanced and high volume, likely formatting
    if (total > 50 && ratio < 0.3) {
      file.isFormatting = true;
    }
  });

  const isLarge = totalInsertions + totalDeletions > 200 || files.length > 5;

  return {
    filesChanged: files.length,
    insertions: totalInsertions,
    deletions: totalDeletions,
    files,
    isLarge,
    summary: buildSmartSummary(files, totalInsertions, totalDeletions),
  };
}

/**
 * Build a concise summary of changes
 * This is what gets sent to the AI instead of full diff when changes are large
 */
function buildSmartSummary(
  files: FileChange[],
  insertions: number,
  deletions: number
): string {
  const parts: string[] = [];

  // Group by status
  const added = files.filter((f) => f.status === "added");
  const modified = files.filter((f) => f.status === "modified");
  const deleted = files.filter((f) => f.status === "deleted");
  const renamed = files.filter((f) => f.status === "renamed");
  const formatting = files.filter((f) => f.isFormatting);

  if (formatting.length > 0) {
    parts.push(`Formatting: ${formatting.map((f) => f.path).join(", ")}`);
  }

  if (added.length > 0) {
    parts.push(`Added: ${added.map((f) => f.path).join(", ")}`);
  }

  if (modified.length > 0) {
    const nonFormatting = modified.filter((f) => !f.isFormatting);
    if (nonFormatting.length > 0) {
      parts.push(`Modified: ${nonFormatting.map((f) => f.path).join(", ")}`);
    }
  }

  if (deleted.length > 0) {
    parts.push(`Deleted: ${deleted.map((f) => f.path).join(", ")}`);
  }

  if (renamed.length > 0) {
    parts.push(`Renamed: ${renamed.map((f) => f.path).join(", ")}`);
  }

  parts.push(`(+${insertions}, -${deletions} lines)`);

  return parts.join("\n");
}

/**
 * Truncate diff to fit within token limits
 * Keeps the most important parts: file names and a sample of changes
 */
export function truncateDiff(diff: string, maxLines: number = 100): string {
  const lines = diff.split("\n");

  if (lines.length <= maxLines) {
    return diff;
  }

  const important: string[] = [];
  const changes: string[] = [];

  for (const line of lines) {
    // Always keep file headers and metadata
    if (
      line.startsWith("diff --git") ||
      line.startsWith("index") ||
      line.startsWith("---") ||
      line.startsWith("+++") ||
      line.startsWith("@@")
    ) {
      important.push(line);
    } else if (line.startsWith("+") || line.startsWith("-")) {
      changes.push(line);
    }
  }

  // Take a sample of actual changes
  const sampleSize = Math.floor(maxLines * 0.7); // 70% for changes
  const sampled = sampleChanges(changes, sampleSize);

  return [...important, ...sampled, "\n... (diff truncated for brevity)"].join(
    "\n"
  );
}

/**
 * Smart sampling: prefer meaningful changes over noise
 */
function sampleChanges(changes: string[], count: number): string[] {
  if (changes.length <= count) {
    return changes;
  }

  // Prioritize changes that look meaningful (not just whitespace/formatting)
  const meaningful = changes.filter(
    (line) =>
      line.trim().length > 5 && // Not just whitespace
      !line.match(/^[+-]\s*$/) && // Not empty lines
      !line.match(/^[+-]\s*[{}()\[\];,]$/) // Not just brackets
  );

  const noise = changes.filter((line) => !meaningful.includes(line));

  // Take more from meaningful changes
  const meaningfulCount = Math.min(meaningful.length, Math.floor(count * 0.8));
  const noiseCount = count - meaningfulCount;

  return [
    ...meaningful.slice(0, meaningfulCount),
    ...noise.slice(0, noiseCount),
  ];
}
