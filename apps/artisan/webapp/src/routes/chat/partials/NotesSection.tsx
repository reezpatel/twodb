import { useCallback, useEffect, useRef, useState } from "react";
import { artisanClient } from "../../../lib/artisan-client.js";
import { SideSection } from "./SidePanel.js";

/**
 * Per-session scratchpad: a plain markdown editor saved server-side on every
 * edit (debounced) and reloaded with the session. It is NEVER part of the
 * model context — private user notes only.
 */
export function NotesSection({ sessionId }: { sessionId: string }) {
  const [text, setText] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dirty = useRef(false);

  useEffect(() => {
    setLoaded(false);
    setText("");
    dirty.current = false;
    void artisanClient.getSession(sessionId).then((d) => {
      // Don't clobber text typed while the fetch was in flight.
      if (!dirty.current) setText(d.notes ?? "");
      setLoaded(true);
    }).catch(() => setLoaded(true));
  }, [sessionId]);

  const save = useCallback(async (value: string) => {
    setSaving("saving");
    try {
      await artisanClient.updateSession(sessionId, { notes: value || null });
      setSaving("saved");
    } catch {
      setSaving("error");
    }
  }, [sessionId]);

  const onChange = (value: string) => {
    dirty.current = true;
    setText(value);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void save(value), 800);
  };

  // Flush a pending save on unmount / session switch.
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, [sessionId]);

  return (
    <SideSection title="Notes">
      {loaded ? (
        <div className="flex flex-col gap-1">
          <textarea
            value={text}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Private notes — markdown, never sent to the agent…"
            spellCheck={false}
            rows={6}
            className="min-h-24 w-full resize-y rounded-md border border-outline bg-surface px-2 py-1.5 font-mono text-[12px] leading-relaxed text-ink outline-none placeholder:text-ink-faint focus:border-info/50"
          />
          <span className={`self-end text-[10px] ${saving === "error" ? "text-destructive" : "text-ink-muted/60"}`}>
            {saving === "saving" ? "saving…" : saving === "saved" ? "saved" : saving === "error" ? "save failed" : "\u00a0"}
          </span>
        </div>
      ) : (
        <p className="py-1 text-[11px] text-ink-muted">loading…</p>
      )}
    </SideSection>
  );
}

