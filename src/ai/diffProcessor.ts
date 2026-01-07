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

export function processDiff(diff: string): DiffSummary {
  const lines = diff.split("\n");
  const files: FileChange[] = [];
  let currentFile: FileChange | null = null;

  let totalInsertions = 0;
  let totalDeletions = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.startsWith("diff --git")) {
      if (currentFile) {
        files.push(currentFile);
      }

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

    if (line.startsWith("new file mode")) {
      if (currentFile) currentFile.status = "added";
    }

    if (line.startsWith("deleted file mode")) {
      if (currentFile) currentFile.status = "deleted";
    }

    if (line.startsWith("rename from")) {
      if (currentFile) currentFile.status = "renamed";
    }

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

  files.forEach((file) => {
    const total = file.additions + file.deletions;
    const ratio = Math.abs(file.additions - file.deletions) / (total || 1);

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

function buildSmartSummary(
  files: FileChange[],
  insertions: number,
  deletions: number
): string {
  const parts: string[] = [];

  const added = files.filter((f) => f.status === "added");
  const modified = files.filter((f) => f.status === "modified");
  const deleted = files.filter((f) => f.status === "deleted");
  const renamed = files.filter((f) => f.status === "renamed");
  const formatting = files.filter((f) => f.isFormatting);

  const fileList: string[] = [];

  if (added.length > 0) {
    added.forEach((f) => {
      fileList.push(`  - ${f.path} (new file, +${f.additions} lines)`);
    });
  }

  if (modified.length > 0) {
    const nonFormatting = modified.filter((f) => !f.isFormatting);
    nonFormatting.forEach((f) => {
      fileList.push(
        `  - ${f.path} (modified, +${f.additions}/-${f.deletions} lines)`
      );
    });
  }

  if (deleted.length > 0) {
    deleted.forEach((f) => {
      fileList.push(`  - ${f.path} (deleted, -${f.deletions} lines)`);
    });
  }

  if (renamed.length > 0) {
    renamed.forEach((f) => {
      fileList.push(`  - ${f.path} (renamed)`);
    });
  }

  if (formatting.length > 0) {
    formatting.forEach((f) => {
      fileList.push(`  - ${f.path} (formatting only)`);
    });
  }

  parts.push(`Files changed (${files.length}):`);
  parts.push(...fileList);
  parts.push(`\nTotal: +${insertions} insertions, -${deletions} deletions`);

  return parts.join("\n");
}

export function truncateDiff(diff: string, maxLines: number = 100): string {
  const lines = diff.split("\n");

  if (lines.length <= maxLines) {
    return diff;
  }

  const important: string[] = [];
  const changes: string[] = [];

  for (const line of lines) {
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

  const sampleSize = Math.floor(maxLines * 0.7); // 70% for changes
  const sampled = sampleChanges(changes, sampleSize);

  return [...important, ...sampled, "\n... (diff truncated for brevity)"].join(
    "\n"
  );
}

function sampleChanges(changes: string[], count: number): string[] {
  if (changes.length <= count) {
    return changes;
  }

  const meaningful = changes.filter(
    (line) =>
      line.trim().length > 5 &&
      !line.match(/^[+-]\s*$/) &&
      !line.match(/^[+-]\s*[{}()\[\];,]$/)
  );

  const noise = changes.filter((line) => !meaningful.includes(line));

  const meaningfulCount = Math.min(meaningful.length, Math.floor(count * 0.8));
  const noiseCount = count - meaningfulCount;

  return [
    ...meaningful.slice(0, meaningfulCount),
    ...noise.slice(0, noiseCount),
  ];
}