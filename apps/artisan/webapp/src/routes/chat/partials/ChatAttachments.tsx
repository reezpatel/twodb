import { Paperclip, X } from "lucide-react";
import { cn } from "../../../lib/cn.js";

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
  const matches = props.files
    .filter((f) => f.toLowerCase().includes(props.query.toLowerCase()))
    .slice(0, 8);
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

/** Queued-message pills above the composer (legacy code-chat-queue). */
export function QueuePills(props: {
  items: Array<{ id: string; content: string }>;
  onRemove: (id: string) => void;
  onSendNow: (id: string) => void;
}) {
  if (props.items.length === 0) return null;
  return (
    <div data-slot="queue-pills" className="flex flex-col gap-1 px-1">
      {props.items.map((item, i) => (
        <div
          key={item.id}
          className="group flex items-center gap-2 rounded-md border border-outline bg-surface px-2 py-1 text-[12px]"
        >
          <span className="shrink-0 rounded bg-info/15 px-1 py-px text-[10px] text-info">{i === 0 ? "next" : `queued ${i + 1}`}</span>
          <span className="min-w-0 flex-1 truncate text-ink-muted">{item.content}</span>
          <button
            type="button"
            title="Send now (stops the current run)"
            className="shrink-0 text-[10px] text-info opacity-0 hover:underline group-hover:opacity-100"
            onClick={() => props.onSendNow(item.id)}
          >
            send now
          </button>
          <button
            type="button"
            aria-label="Remove queued message"
            className="shrink-0 text-ink-muted opacity-0 hover:text-destructive group-hover:opacity-100"
            onClick={() => props.onRemove(item.id)}
          >
            <X className="size-3" />
          </button>
        </div>
      ))}
    </div>
  );
}
