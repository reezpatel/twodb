import { Archive, Trash2, X } from "lucide-react";
import { Button } from "@twodb/blocks";
import { AssigneePicker, PriorityPicker, StatusPicker } from "../../components/PropertyPickers";
import type { Priority } from "../../lib/types";

interface Props {
  count: number; onClear: () => void; statusId: string;
  onApply: (patch: Record<string, unknown>) => void; onArchive: () => void; onDelete: () => void;
}

/** Floating action bar shown while rows are selected. */
export function BulkBar({ count, onClear, onApply, onArchive, onDelete, statusId }: Props) {
  return (
    <div className="sticky bottom-4 z-20 mx-auto flex w-fit items-center gap-1 rounded-full border border-outline bg-popover px-3 py-1.5 shadow-lg">
      <span className="px-2 text-sm font-medium">{count} selected</span>
      <StatusPicker compact value={statusId} onChange={(v) => onApply({ statusId: v })} />
      <PriorityPicker compact value={null} onChange={(v: Priority | null) => onApply({ priority: v })} />
      <AssigneePicker compact value={null} onChange={(v) => onApply({ assigneeUserId: v })} />
      <Button size="sm" variant="ghost" onClick={onArchive}><Archive />Archive</Button>
      <Button size="sm" variant="ghost" className="text-destructive" onClick={onDelete}><Trash2 />Delete</Button>
      <button onClick={onClear} aria-label="Clear selection" className="rounded-full p-1 text-ink-muted hover:bg-paper-grid"><X className="size-4" /></button>
    </div>
  );
}
