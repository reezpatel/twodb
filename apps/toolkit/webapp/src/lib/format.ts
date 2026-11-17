/** "Sep 2, 2026" — or the fallback when there is no date. */
export function formatDate(iso: string | null | undefined, fallback = "—"): string {
  if (!iso) return fallback;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return fallback;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

/** "2 min ago", "Yesterday", "6 days ago", else the date. */
export function formatRelative(iso: string | null | undefined, fallback = "Never"): string {
  if (!iso) return fallback;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return fallback;
  const sec = Math.max(0, Math.round((Date.now() - t) / 1000));
  if (sec < 60) return "Just now";
  if (sec < 3600) return `${Math.floor(sec / 60)} min ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)} h ago`;
  const days = Math.floor(sec / 86400);
  if (days === 1) return "Yesterday";
  if (days < 30) return `${days} days ago`;
  return formatDate(iso);
}
