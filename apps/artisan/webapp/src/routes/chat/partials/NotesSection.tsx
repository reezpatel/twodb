import { useCallback, useEffect, useRef, useState } from "react";
import { artisanClient } from "../../../lib/artisan-client.js";
import { OvertypeEditor } from "../../../components/ui/overtype-editor.js";
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
    // Explicit bottom border: Notes is often the last child, where the default `last:border-b-0` would drop it.
    <SideSection title="Notes" flush className="last:border-b">
      {loaded ? (
        <div className="relative">
          <OvertypeEditor
            key={sessionId}
            value={text}
            onChange={onChange}
            ariaLabel="Session notes"
            placeholder="Private notes — markdown, never sent to the agent…"
            fontSize="12px"
            padding="12px"
            className="h-44 overflow-hidden border-0 border-b border-outline bg-transparent shadow-none outline-none"
          />
          <span className={`pointer-events-none absolute right-3 bottom-1.5 text-[10px] ${saving === "error" ? "text-destructive" : "text-ink-muted/60"}`}>
            {saving === "saving" ? "saving…" : saving === "saved" ? "saved" : saving === "error" ? "save failed" : "\u00a0"}
          </span>
        </div>
      ) : (
        <p className="px-3 py-3 text-[11px] text-ink-muted">loading…</p>
      )}
    </SideSection>
  );
}
