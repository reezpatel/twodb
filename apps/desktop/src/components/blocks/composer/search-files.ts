/** fzf-flavored ranking for @ file suggestions — basename substring < path substring < subsequence. */
const subsequence = (path: string, query: string) => {
  let i = 0;
  for (const ch of path) {
    if (ch === query[i]) i += 1;
    if (i === query.length) return true;
  }
  return false;
};

/** fzf-flavored ranking: basename substring < path substring < subsequence, shorter wins. */
export function searchFiles(files: string[], query: string, limit = 10): string[] {
  const q = query.trim().toLowerCase();
  if (!q) {
    return [...files].sort((a, b) => a.split("/").length - b.split("/").length || a.length - b.length || a.localeCompare(b)).slice(0, limit);
  }
  const scored: { path: string; score: number }[] = [];
  for (const file of files) {
    const lower = file.toLowerCase();
    const bare = lower.endsWith("/") ? lower.slice(0, -1) : lower;
    const base = bare.slice(bare.lastIndexOf("/") + 1);
    let score: number | null = null;
    if (base.includes(q)) score = base.startsWith(q) ? 0 : 1;
    else if (lower.includes(q)) score = 2;
    else if (subsequence(lower, q)) score = 3;
    if (score !== null) scored.push({ path: file, score });
  }
  return scored
    .sort((a, b) => a.score - b.score || a.path.length - b.path.length || a.path.localeCompare(b.path))
    .slice(0, limit)
    .map((s) => s.path);
}
