import { useCallback, useRef, useState } from "react";
import { api, errorMessage } from "../../lib/api";
import { refreshAll } from "../../lib/actions";
import { feedback } from "../../lib/feedback";
import { formatQty } from "../../lib/format";
import type { Item, Place, ResolveMatch } from "../../lib/types";
import type { ScanMode } from "../ScanContext";

export type Target = Pick<Place, "id" | "name" | "path">;

export interface ScanEntry {
  id: number;
  raw: string;
  at: number;
  status: "pending" | "done" | "error";
  matches: ResolveMatch[];
  /** One-line outcome for put-away / stock modes. */
  outcome?: { tone: "ok" | "warn" | "error"; text: string };
  undo?: () => Promise<void>;
}

/**
 * Business logic for one scan session: resolve each code, then act on it
 * according to the mode. Lookup only shows; put-away moves items into the
 * current target (scanning a place label re-targets); stock modes ±1.
 */
export function useScanSession(initial: { mode?: ScanMode; target?: Target | null }) {
  const [mode, setMode] = useState<ScanMode>(initial.mode ?? "lookup");
  const [target, setTarget] = useState<Target | null>(initial.target ?? null);
  const [entries, setEntries] = useState<ScanEntry[]>([]);
  const seq = useRef(0);
  const modeRef = useRef(mode);
  modeRef.current = mode;
  const targetRef = useRef(target);
  targetRef.current = target;

  const patch = (id: number, p: Partial<ScanEntry>) => setEntries((es) => es.map((e) => (e.id === id ? { ...e, ...p } : e)));

  const actOnItem = useCallback(async (entryId: number, item: Item) => {
    const m = modeRef.current;
    const t = targetRef.current;
    if (m === "putaway") {
      if (!t) {
        feedback("warn");
        patch(entryId, { outcome: { tone: "warn", text: "Scan a box / place label first to choose where things go." } });
        return;
      }
      if (item.locationId === t.id) {
        feedback("ok");
        patch(entryId, { outcome: { tone: "ok", text: `Already in ${t.name}` } });
        return;
      }
      const from = item.locationId;
      await api.moveItems([item.id], t.id);
      refreshAll();
      feedback("ok");
      patch(entryId, {
        outcome: { tone: "ok", text: `Moved into ${t.name}` },
        undo: async () => {
          await api.moveItems([item.id], from);
          refreshAll();
        },
      });
    } else if (m === "stockIn" || m === "stockOut") {
      const delta = m === "stockIn" ? 1 : -1;
      if (delta < 0 && item.quantity <= 0) {
        feedback("warn");
        patch(entryId, { outcome: { tone: "warn", text: "Already at 0" } });
        return;
      }
      const next = await api.adjust(item.id, { delta, reason: "scan" });
      refreshAll();
      feedback(next.low ? "warn" : "ok");
      patch(entryId, {
        matches: [{ type: "item", via: "label", item: next }],
        outcome: { tone: next.low ? "warn" : "ok", text: `${delta > 0 ? "+1" : "−1"} → ${formatQty(next.quantity)} ${next.unit}${next.low ? " · low stock" : ""}` },
        undo: async () => {
          await api.adjust(item.id, { delta: -delta, reason: "scan undo" });
          refreshAll();
        },
      });
    } else feedback("ok");
  }, []);

  const handle = useCallback(
    async (raw: string) => {
      const id = ++seq.current;
      setEntries((es) => [{ id, raw, at: Date.now(), status: "pending" as const, matches: [] }, ...es].slice(0, 40));
      try {
        const res = await api.resolve(raw);
        patch(id, { status: "done", matches: res.matches });
        const places = res.matches.filter((m) => m.type === "location");
        const items = res.matches.filter((m) => m.type === "item");
        const m = modeRef.current;

        if (places.length && m !== "lookup") {
          const p = places[0].location;
          setTarget({ id: p.id, name: p.name, path: p.path });
          if (m !== "putaway") setMode("putaway");
          feedback("ok");
          patch(id, { outcome: { tone: "ok", text: `Now putting away into ${p.name}` } });
          return;
        }
        if (items.length === 1) return void (await actOnItem(id, items[0].item));
        if (items.length > 1) {
          feedback("warn");
          patch(id, { outcome: m === "lookup" ? undefined : { tone: "warn", text: `${items.length} items share this barcode — pick one below.` } });
          return;
        }
        if (!res.matches.length || res.matches[0].type === "free_code") feedback(m === "lookup" ? "ok" : "warn");
        else feedback("ok");
      } catch (e) {
        feedback("error");
        patch(id, { status: "error", outcome: { tone: "error", text: errorMessage(e) } });
      }
    },
    [actOnItem],
  );

  const runUndo = async (entry: ScanEntry) => {
    if (!entry.undo) return;
    await entry.undo();
    patch(entry.id, { undo: undefined, outcome: { tone: "warn", text: "Undone" } });
  };

  /** Explicit choice when several items matched (stock / put-away modes). */
  const chooseItem = (entry: ScanEntry, item: Item) => {
    patch(entry.id, { matches: [{ type: "item", via: "barcode", item }] });
    void actOnItem(entry.id, item);
  };

  return { mode, setMode, target, setTarget, entries, handle, runUndo, chooseItem, clear: () => setEntries([]) };
}
