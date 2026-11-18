import { useCallback, useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { apiFetch } from "../../../lib/artisan-client.js";

/**
 * Away mode (workspace-wide): while on, the agent's ask_user never blocks —
 * it auto-answers with the recommended option (first option, or "use your
 * best judgment" when there are none). Persisted server-side.
 */
export function AwayToggle() {
  const [away, setAway] = useState<boolean | null>(null);

  useEffect(() => {
    void apiFetch("/settings/away-mode")
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { away?: boolean } | null) => setAway(d?.away ?? false))
      .catch(() => setAway(false));
  }, []);

  const toggle = useCallback(() => {
    const next = !(away ?? false);
    setAway(next); // optimistic
    void apiFetch("/settings/away-mode", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ away: next }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { away?: boolean } | null) => setAway(d?.away ?? false))
      .catch(() => setAway((v) => !(v ?? false)));
  }, [away]);

  if (away === null) return null;
  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={away}
      title={away ? "Away mode ON — ask_user auto-answers with the recommended option" : "Away mode — auto-answer ask_user with the recommended option"}
      className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] transition-colors ${
        away ? "border-ion-deep/40 bg-ion-deep/15 text-ion-deep" : "border-outline text-ink-muted hover:text-ink"
      }`}
    >
      {away ? <Moon className="size-3" /> : <Sun className="size-3" />}
      away
    </button>
  );
}

