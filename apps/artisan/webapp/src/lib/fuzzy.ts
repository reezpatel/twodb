/**
 * Small fuzzy matcher for the composer's `@` (paths) and `/` (commands).
 * Query chars must appear in order (subsequence); score rewards consecutive
 * runs, word/path-segment starts and basename hits, and penalises gaps and
 * length. Returns null when it doesn't match.
 */
export function fuzzyScore(text: string, query: string): number | null {
  if (!query) return 0;
  const t = text.toLowerCase();
  const q = query.toLowerCase();
  let score = 0;
  let ti = 0;
  let prev = -2;
  for (let qi = 0; qi < q.length; qi++) {
    const idx = t.indexOf(q[qi], ti);
    if (idx === -1) return null;
    const boundary = idx === 0 || "/-_. ".includes(t[idx - 1]);
    score += 1;
    if (idx === prev + 1) score += 3; // consecutive
    if (boundary) score += 4; // segment / word start
    score -= Math.min(3, (idx - ti) * 0.2); // gap since last match
    prev = idx;
    ti = idx + 1;
  }
  // Basename (or whole string) contains the query contiguously → strong boost.
  const trimmed = t.endsWith("/") ? t.slice(0, -1) : t;
  const base = trimmed.slice(trimmed.lastIndexOf("/") + 1);
  if (base.startsWith(q)) score += 12;
  else if (base.includes(q)) score += 8;
  else if (t.includes(q)) score += 3;
  return score - t.length * 0.02; // shorter paths first on ties
}

/** Filter + rank items by fuzzy score of `getText`; stable on ties. */
export function fuzzyFilter<T>(items: T[], query: string, getText: (item: T) => string, limit: number): T[] {
  const q = query.trim();
  if (!q) return items.slice(0, limit);
  return items
    .map((item, i) => ({ item, i, s: fuzzyScore(getText(item), q) }))
    .filter((x): x is { item: T; i: number; s: number } => x.s !== null)
    .sort((a, b) => b.s - a.s || a.i - b.i)
    .slice(0, limit)
    .map((x) => x.item);
}
