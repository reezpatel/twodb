import { useCallback, useEffect, useRef, useState } from "react";
import { useBoardSocket } from "../../board/hooks/useBoardSocket";

export type DocView = "split" | "edit" | "preview";
interface Conflict {
  markdown: string;
  version: number;
}

/**
 * Holding hook for BoardDoc. The textarea is the human's; saves are debounced
 * and guarded by the doc version. If someone else (an agent) saved while the
 * human has unsaved edits, nothing is overwritten: a conflict banner offers
 * "use theirs" or "keep mine".
 */
export function useBoardDoc(boardId: string) {
  const [text, setText] = useState("");
  const [view, setView] = useState<DocView>("split");
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [conflict, setConflict] = useState<Conflict | null>(null);
  const [aiNote, setAiNote] = useState<string | null>(null);
  const version = useRef(0);
  const saved = useRef("");
  const latest = useRef("");
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const clientRef = useRef("");
  const sendRef = useRef<(m: string, v?: number) => Promise<{ seq: number; version: number }>>(() => Promise.reject(new Error("offline")));

  const adopt = useCallback((markdown: string, v: number) => {
    version.current = v;
    saved.current = markdown;
    latest.current = markdown;
    setText(markdown);
    setConflict(null);
  }, []);

  const incoming = useCallback(
    (markdown: string, v: number, byAi: boolean) => {
      const dirty = latest.current !== saved.current;
      if (!dirty) {
        adopt(markdown, v);
        if (byAi) setAiNote("An agent updated this document.");
      } else if (markdown !== latest.current) setConflict({ markdown, version: v });
      else adopt(markdown, v);
    },
    [adopt],
  );

  const socket = useBoardSocket(boardId, {
    onSnapshot: (m) => {
      if (m.doc) incoming(m.doc.markdown, m.doc.version, false);
      setLoaded(true);
    },
    onEvents: ({ events }) => {
      for (const ev of events) if (ev.doc && ev.origin !== clientRef.current) incoming(ev.doc.markdown, ev.doc.version, ev.actor.startsWith("agent:"));
    },
  });
  clientRef.current = socket.clientId;
  sendRef.current = socket.sendDoc;

  const save = useCallback(async () => {
    const md = latest.current;
    if (md === saved.current) return;
    setSaving(true);
    try {
      const r = await sendRef.current(md, version.current);
      version.current = r.version;
      saved.current = md;
    } catch (e) {
      if ((e as { code?: string }).code === "version_conflict") socket.resync(); // snapshot decides: conflict banner or silent adopt
    } finally {
      setSaving(false);
    }
  }, [socket]);

  const onChange = useCallback(
    (md: string) => {
      latest.current = md;
      setText(md);
      setAiNote(null);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => void save(), 700);
    },
    [save],
  );
  useEffect(() => () => clearTimeout(timer.current), []);

  // Flush pending edits when the connection comes back.
  useEffect(() => {
    if (socket.status === "open" && loaded) void save();
  }, [socket.status, loaded, save]);

  return {
    text,
    view,
    setView,
    loaded,
    saving,
    dirty: text !== saved.current,
    status: socket.status,
    conflict,
    aiNote,
    dismissAiNote: () => setAiNote(null),
    onChange,
    useTheirs: () => conflict && adopt(conflict.markdown, conflict.version),
    keepMine: () => {
      if (!conflict) return;
      version.current = conflict.version; // overwrite on purpose
      setConflict(null);
      void save();
    },
  };
}
