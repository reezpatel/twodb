/**
 * Teams web scraping — all DOM knowledge lives here so a Teams UI change is
 * a one-file fix. Selectors are best-effort with fallbacks; Teams v2 markup
 * shifts often. Run with TWODB_TEAMS_DEBUG=1 to dump raw scrape payloads for
 * tuning against a real tenant.
 */

export const TEAMS_HOME = "https://teams.microsoft.com/v2/";
export const TEAMS_ACTIVITY = "https://teams.microsoft.com/v2/activity";

export const LOGIN_HOST_RE = /login\.microsoftonline\.com|login\.live\.com|login\.microsoft\.com|aadcdn\.msauth\.net/i;
export const TEAMS_HOST_RE = /teams\.microsoft\.com|teams\.office\.com/i;

/** In-page: scrape the activity feed into flat items. */
export function scrapeActivityInPage() {
  const text = (el: Element | null) => (el?.textContent ?? "").replace(/\s+/g, " ").trim();
  const items: { id: string; text: string; timeText: string; href: string | null }[] = [];
  const seen = new Set<string>();

  const candidates = document.querySelectorAll(
    '[data-tid*="activity" i] li, [data-tid*="activity" i][role="listitem"], li[role="listitem"], [role="feed"] > *',
  );
  for (const el of Array.from(candidates).slice(0, 60)) {
    const body = text(el);
    if (!body || body.length < 8) continue;
    const timeEl = el.querySelector("time, [data-tid*='time' i], [data-tid*='date' i]");
    const timeText = timeEl?.getAttribute("datetime") ?? text(timeEl);
    const link = el.querySelector("a[href]")?.getAttribute("href") ?? null;
    const id = `${body.slice(0, 120)}|${timeText}`;
    if (seen.has(id)) continue;
    seen.add(id);
    items.push({ id, text: body.slice(0, 500), timeText, href: link });
  }
  return items;
}

/** In-page: scrape the chat list for unread conversations. */
export function scrapeUnreadChatsInPage() {
  const text = (el: Element | null) => (el?.textContent ?? "").replace(/\s+/g, " ").trim();
  const out: { id: string; name: string; preview: string; unread: number }[] = [];

  const rows = document.querySelectorAll(
    '[data-tid*="chat-list" i] [role="listitem"], [data-tid*="chat" i][role="treeitem"], [role="tree"] [role="treeitem"]',
  );
  for (const row of Array.from(rows).slice(0, 80)) {
    const badge = row.querySelector('[data-tid*="unread" i], [aria-label*="unread" i]');
    if (!badge) continue;
    const name = text(row.querySelector('[data-tid*="name" i], [id*="title" i]')) || text(row).slice(0, 80);
    const preview = text(row.querySelector('[data-tid*="preview" i], [data-tid*="message" i]'));
    const badgeLabel = badge.getAttribute("aria-label") ?? "";
    const m = badgeLabel.match(/(\d+)/);
    out.push({ id: name, name, preview: preview.slice(0, 300), unread: m ? Number(m[1]) : 1 });
  }
  return out;
}

/** In-page: detect an incoming-call toast; returns the caller label. */
export function detectCallToastInPage() {
  const text = (el: Element | null) => (el?.textContent ?? "").replace(/\s+/g, " ").trim();
  const toasts = document.querySelectorAll('[data-tid*="toast" i], [role="alert"], [data-tid*="calling" i], [class*="toast" i]');
  for (const t of Array.from(toasts)) {
    const body = text(t);
    if (!body) continue;
    if (/incoming call|is calling|incoming video/i.test(body)) {
      const caller = body.replace(/incoming (audio |video )?call[:\s]*/i, "").split("\n")[0]?.slice(0, 120) || "Unknown caller";
      return { ringing: true as const, caller };
    }
  }
  return { ringing: false as const, caller: null };
}

/** Classify an activity-feed item into an event kind. */
export function classifyActivity(text: string): "mention" | "call" | "message" {
  if (/missed (an? )?(audio |video )?call|tried to call|call from/i.test(text)) return "call";
  if (/mentioned you|@mention|replied to|tagged you/i.test(text)) return "mention";
  return "message";
}
