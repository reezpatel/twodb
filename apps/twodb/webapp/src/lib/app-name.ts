/**
 * Display name for an app. The control plane already sends brand names for catalog apps
 * ("TwoDoo"); this only repairs lowercase names (external apps registered by slug):
 *   "my-cool-app" → "My Cool App", "twomail" → "TwoMail", "membrain" → "Membrain".
 */
export function formatAppName(name: string): string {
  const n = name.trim();
  if (!n) return n;
  if (/[A-Z]/.test(n)) return n; // already has intentional casing
  const cap = (w: string) => (w ? w[0].toUpperCase() + w.slice(1) : w);
  if (/[-_\s]/.test(n)) return n.split(/[-_\s]+/).map(cap).join(" ");
  // First-party "two…" family: TwoMail, TwoContacts, …
  const m = n.match(/^two(.+)$/);
  return m ? `Two${cap(m[1])}` : cap(n);
}
