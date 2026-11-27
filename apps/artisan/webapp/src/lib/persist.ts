/** Tiny JSON-in-localStorage helpers (never throw: private mode / quota). */
export function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? ({ ...(fallback as object), ...JSON.parse(raw) } as T) : fallback;
  } catch {
    return fallback;
  }
}

export function writeJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore */
  }
}

/** Per-session UI state (main tab, right-sidebar tab/open). Width uses its own key. */
export interface SessionUiState {
  tab: string;
  sidebarView: string;
  sidebarOpen: boolean | null;
}
export const sessionUiKey = (sessionId: string) => `artisan.session.${sessionId}.ui`;
export const readSessionUi = (sessionId: string): SessionUiState =>
  readJson<SessionUiState>(sessionUiKey(sessionId), { tab: "chat", sidebarView: "default", sidebarOpen: null });
