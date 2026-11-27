import { Paperclip, X } from "lucide-react";
import { MessageQueue } from "@twodb/blocks";
import { cn } from "../../../lib/cn.js";
import { fuzzyFilter } from "../../../lib/fuzzy.js";

/** Attached-file chips above the composer (legacy code-chat-attachments).
 *  `items` are { path, uploaded?, name? }; uploaded files show their basename. */
export function AttachmentChips(props: { items: Array<{ path: string; uploaded?: boolean; name?: string }>; onRemove: (path: string) => void }) {
  if (props.items.length === 0) return null;
  return (
    <div data-slot="attachment-chips" className="flex flex-wrap gap-1 px-1">
      {props.items.map((item) => (
        <span
          key={item.path}
          className="flex max-w-56 items-center gap-1 rounded-md border border-outline bg-surface px-1.5 py-0.5 font-mono text-[11px] text-ink-muted"
          title={item.path}
        >
          <Paperclip className="size-3 shrink-0" />
          <span className="truncate">{item.uploaded ? (item.name ?? item.path.split("/").pop()) : item.path}</span>
          <button
            type="button"
            aria-label={`Remove attachment ${item.path}`}
            className="shrink-0 text-ink-muted hover:text-destructive"
            onClick={() => props.onRemove(item.path)}
          >
            <X className="size-3" />
          </button>
        </span>
      ))}
    </div>
  );
}

/** `@` mention popup: filtered directory files, keyboard navigable. */
export function MentionPopup(props: {
  query: string;
  files: string[];
  activeIndex: number;
  onPick: (index: number) => void;
  onHover: (index: number) => void;
}) {
  const matches = fuzzyFilter(props.files, props.query, (f) => f, 8);
  if (matches.length === 0) return null;
  return (
    <div
      data-slot="mention-popup"
      role="listbox"
      className="absolute bottom-full left-0 z-40 mb-1 max-h-56 w-80 overflow-y-auto rounded-md border border-outline bg-surface shadow-lg"
    >
      {matches.map((f, i) => (
        <button
          key={f}
          type="button"
          role="option"
          aria-selected={i === props.activeIndex}
          className={cn(
            "block w-full truncate px-2.5 py-1 text-left font-mono text-[12px]",
            i === props.activeIndex ? "bg-surface-muted text-ink" : "text-ink-muted",
          )}
          onMouseEnter={() => props.onHover(i)}
          onClick={() => props.onPick(i)}
        >
          {f}
        </button>
      ))}
    </div>
  );
}

/** Queued (steering) messages above the composer, using the shared blocks
 * MessageQueue. The queue lives on the server, so every viewer sees the same
 * items and a reload loses nothing. "Steer" sends the whole queue now (stops
 * the current run); reordering isn't supported server-side. */
export function QueuePills(props: {
  items: Array<{ id: string; content: string }>;
  onRemove: (id: string) => void;
  onSendNow: () => void;
}) {
  if (props.items.length === 0) return null;
  return <MessageQueue items={props.items} onRemove={props.onRemove} onSendNow={() => props.onSendNow()} />;
}
