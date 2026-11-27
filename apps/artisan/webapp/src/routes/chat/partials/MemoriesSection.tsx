import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { artisanClient, type MemoryInfo, type MemoryLevel } from "../../../lib/artisan-client.js";
import { useWorkspaceWs } from "../../../lib/workspace-ws.js";
import { MemoryDialog } from "./MemoryDialog.js";
import { SideSection } from "./SidePanel.js";

const LIMIT = 5;

const LEVELS: Array<{ id: MemoryLevel; label: string; hint: string }> = [
  { id: "organization", label: "Global", hint: "Every agent" },
  { id: "code_directory", label: "Directory", hint: "This directory" },
  { id: "self", label: "Agent", hint: "This agent's own" },
  { id: "session", label: "Session", hint: "This session only — survives compaction" },
];
const MEMORY_TOOLS = new Set(["add_memory", "update_memory", "delete_memory"]);

/** What this session's agent sees: titles by level, click to read/edit, plus manual add. */
export function MemoriesSection({ sessionId }: { sessionId: string }) {
  const { onFrame } = useWorkspaceWs();
  const [items, setItems] = useState<MemoryInfo[] | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    artisanClient.listMemories(sessionId).then(setItems).catch(() => setItems((v) => v ?? []));
  }, [sessionId]);

  useEffect(() => {
    setItems(null);
    setOpen(null);
    load();
    const t = setInterval(load, 15_000);
    return () => clearInterval(t);
  }, [load]);

  // The agent edits memory mid-run — refresh as soon as one of its memory tools finishes.
  useEffect(() => onFrame((f) => {
    if (f.sessionId === sessionId && f.type === "tool_result" && MEMORY_TOOLS.has(String(f.name))) load();
  }), [onFrame, sessionId, load]);

  const remove = async (m: MemoryInfo) => {
    setItems((v) => v?.filter((x) => x.id !== m.id) ?? v);
    await artisanClient.deleteMemory(m.id).catch((e: Error) => setError(e.message));
    load();
  };

  const openMemory = items?.find((m) => m.id === open) ?? null;
  const allGroups = LEVELS.map((l) => ({ ...l, rows: (items ?? []).filter((m) => m.level === l.id) })).filter((g) => g.rows.length > 0);
  // Show the first LIMIT memories (in group order) until expanded.
  const total = allGroups.reduce((n, g) => n + g.rows.length, 0);
  let budget = expanded ? Infinity : LIMIT;
  const groups = allGroups
    .map((g) => {
      const rows = g.rows.slice(0, Math.max(0, budget));
      budget -= rows.length;
      return { ...g, rows };
    })
    .filter((g) => g.rows.length > 0);

  return (
    <SideSection title="Memories" count={items?.length || undefined}>
      <div className="flex flex-col gap-5">
        {items === null ? <Loader2 className="mx-auto my-2 size-3.5 animate-spin text-ink-muted" /> : null}
        {items && items.length === 0 ? <p className="text-[12px] text-ink-muted">No memories yet — the agent saves durable facts with add_memory.</p> : null}

        {groups.map((g, gi) => (
          <div key={g.id}>
            <p className="pb-2 text-[10px] font-medium uppercase tracking-wide text-ink-muted" title={g.hint}>{g.label}</p>
            <div className="flex flex-wrap gap-1.5">
              {g.rows.map((m) => (
                <MemoryPill key={m.id} memory={m} onOpen={() => setOpen(m.id)} />
              ))}
              {gi === groups.length - 1 && total > LIMIT ? (
                <button
                  type="button"
                  onClick={() => setExpanded((e) => !e)}
                  className="rounded-full px-3.5 py-1.5 text-[13px] text-ink-muted transition-colors hover:text-ink"
                >
                  {expanded ? "Show less" : `Show ${total - LIMIT} more`}
                </button>
              ) : null}
            </div>
          </div>
        ))}

        {error ? <p className="px-1.5 text-[11px] text-destructive">{error}</p> : null}
        {openMemory ? (
          <MemoryDialog
            memory={openMemory}
            levelLabel={LEVELS.find((l) => l.id === openMemory.level)?.label ?? openMemory.level}
            onClose={() => setOpen(null)}
            onSaved={(u) => setItems((v) => v?.map((x) => (x.id === u.id ? u : x)) ?? v)}
            onDelete={() => { setOpen(null); void remove(openMemory); }}
          />
        ) : null}
      </div>
    </SideSection>
  );
}

function MemoryPill({ memory, onOpen }: { memory: MemoryInfo; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      title={memory.title}
      className="max-w-full truncate rounded-full bg-[color-mix(in_oklab,var(--paper)_93%,white)] px-3.5 py-1.5 text-[13px] font-light text-ink transition-colors hover:bg-[color-mix(in_oklab,var(--paper)_85%,white)]"
    >
      {memory.title}
    </button>
  );
}
