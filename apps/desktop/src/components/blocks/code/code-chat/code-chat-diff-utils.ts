import type { Token } from "prism-react-renderer";
import { languageFromPath, tokenizeLines } from "@/lib/syntax-highlight";

export type CodeChatDiffView = "unified" | "split";

export interface CodeChatDiffLine {
  type: "hunk" | "context" | "added" | "removed";
  content: string;
  before?: number;
  after?: number;
  /** Syntax tokens for the line; absent when the language is unknown. */
  tokens?: Token[];
}

export interface CodeChatDiffSplitRow {
  type: "hunk" | "change";
  content?: string;
  left?: CodeChatDiffLine;
  right?: CodeChatDiffLine;
}

const HUNK = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/;
const FILE_HEADER = /^(diff |index |--- |\+\+\+ |\\ No newline|new file|deleted file|similarity|rename )/;

/**
 * Parses a unified diff into display lines with per-side line numbers taken
 * from each hunk header. File headers are dropped; the hunk counts keep a body
 * line like "--- x" from being mistaken for one.
 */
export function parseUnifiedDiff(text: string): CodeChatDiffLine[] {
  const lines: CodeChatDiffLine[] = [];
  let before = 0;
  let after = 0;
  let beforeLeft = 0;
  let afterLeft = 0;
  let inHunk = false;

  for (const raw of text.split("\n")) {
    const hunk = HUNK.exec(raw);
    if (hunk) {
      before = Number(hunk[1]);
      after = Number(hunk[3]);
      beforeLeft = hunk[2] === undefined ? 1 : Number(hunk[2]);
      afterLeft = hunk[4] === undefined ? 1 : Number(hunk[4]);
      inHunk = true;
      lines.push({ type: "hunk", content: raw });
      continue;
    }
    if (!inHunk) continue;
    const budget = beforeLeft > 0 || afterLeft > 0;
    if (!budget && (raw === "" || FILE_HEADER.test(raw))) continue;
    if (raw.startsWith("\\ No newline")) continue;

    const kind = raw[0];
    const content = raw.slice(1);
    if (kind === "+") {
      lines.push({ type: "added", content, after: after++ });
      afterLeft--;
    } else if (kind === "-") {
      lines.push({ type: "removed", content, before: before++ });
      beforeLeft--;
    } else if (kind === " " || raw === "") {
      lines.push({ type: "context", content, before: before++, after: after++ });
      beforeLeft--;
      afterLeft--;
    }
  }
  return lines;
}

/** Pairs removed and added runs side by side; context lines appear on both sides. */
export function toSplitRows(lines: CodeChatDiffLine[]): CodeChatDiffSplitRow[] {
  const rows: CodeChatDiffSplitRow[] = [];
  let removed: CodeChatDiffLine[] = [];
  let added: CodeChatDiffLine[] = [];

  const flush = () => {
    const count = Math.max(removed.length, added.length);
    for (let i = 0; i < count; i++) rows.push({ type: "change", left: removed[i], right: added[i] });
    removed = [];
    added = [];
  };

  for (const line of lines) {
    if (line.type === "removed") removed.push(line);
    else if (line.type === "added") added.push(line);
    else {
      flush();
      rows.push(line.type === "hunk" ? { type: "hunk", content: line.content } : { type: "change", left: line, right: line });
    }
  }
  flush();
  return rows;
}

export function diffStats(lines: CodeChatDiffLine[]) {
  let additions = 0;
  let deletions = 0;
  for (const line of lines) {
    if (line.type === "added") additions++;
    else if (line.type === "removed") deletions++;
  }
  return { additions, deletions };
}

/** Builds a single-hunk unified diff from two texts (longest-common-subsequence line diff). */
export function createUnifiedDiff(before: string, after: string): string {
  const a = before.split("\n");
  const b = after.split("\n");
  const table: number[][] = Array.from({ length: a.length + 1 }, () => Array<number>(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      table[i]![j] = a[i] === b[j] ? table[i + 1]![j + 1]! + 1 : Math.max(table[i + 1]![j]!, table[i]![j + 1]!);
    }
  }

  const body: string[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && a[i] === b[j]) {
      body.push(` ${a[i]}`);
      i++;
      j++;
    } else if (j >= b.length || (i < a.length && table[i + 1]![j]! >= table[i]![j + 1]!)) {
      body.push(`-${a[i]}`);
      i++;
    } else {
      body.push(`+${b[j]}`);
      j++;
    }
  }
  return [`@@ -1,${a.length} +1,${b.length} @@`, ...body].join("\n");
}

/** The language of the file a diff is for, from its "+++ b/path" header (or "--- a/path" for deletions). */
export function languageFromDiff(diff: string): string | undefined {
  const added = /^\+\+\+ (?:b\/)?(.+)$/m.exec(diff)?.[1];
  const removed = /^--- (?:a\/)?(.+)$/m.exec(diff)?.[1];
  return languageFromPath(added && added !== "/dev/null" ? added : removed);
}

/**
 * Adds syntax tokens to each line. The before side (context + removed) and the
 * after side (context + added) are tokenized separately so multi-line comments
 * and strings stay intact on each side.
 */
export function highlightDiffLines(lines: CodeChatDiffLine[], language: string | undefined): CodeChatDiffLine[] {
  if (!language) return lines;

  const sideTokens = (keep: CodeChatDiffLine["type"]) => {
    const indexes: number[] = [];
    const text: string[] = [];
    lines.forEach((line, index) => {
      if (line.type === "context" || line.type === keep) {
        indexes.push(index);
        text.push(line.content);
      }
    });
    return { indexes, tokens: tokenizeLines(text.join("\n"), language) };
  };

  const before = sideTokens("removed");
  const after = sideTokens("added");
  if (!before.tokens && !after.tokens) return lines;

  const result = lines.map((line) => ({ ...line }));
  before.indexes.forEach((lineIndex, i) => {
    if (result[lineIndex]!.type === "removed") result[lineIndex]!.tokens = before.tokens?.[i];
  });
  after.indexes.forEach((lineIndex, i) => {
    if (result[lineIndex]!.type !== "removed") result[lineIndex]!.tokens = after.tokens?.[i];
  });
  return result;
}
