import { useMemo, useState, type ReactNode } from "react";
import { Popover } from "radix-ui";
import { Check, Search } from "lucide-react";

export interface PickerOption { id: string; label: string; icon?: ReactNode; hint?: string }

interface Common {
  options: PickerOption[];
  trigger: ReactNode;
  searchable?: boolean;
  placeholder?: string;
  /** Extra first row that clears the value (e.g. "No assignee"). */
  clearLabel?: string;
  disabled?: boolean;
  align?: "start" | "center" | "end";
  /** Footer slot (e.g. "Create label…"). */
  footer?: ReactNode;
}
type Single = Common & { multiple?: false; value: string | null; onChange: (v: string | null) => void };
type Multi = Common & { multiple: true; value: string[]; onChange: (v: string[]) => void };

/** Searchable single/multi select in a popover. Trigger is any node (styled by the caller). */
export function Picker(props: Single | Multi) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const shown = useMemo(() => props.options.filter((o) => o.label.toLowerCase().includes(q.trim().toLowerCase())), [props.options, q]);
  const isSel = (id: string) => (props.multiple ? props.value.includes(id) : props.value === id);

  const pick = (id: string) => {
    if (props.multiple) props.onChange(props.value.includes(id) ? props.value.filter((x) => x !== id) : [...props.value, id]);
    else { props.onChange(id); setOpen(false); }
  };

  return (
    <Popover.Root open={open} onOpenChange={(o) => { setOpen(o); if (!o) setQ(""); }}>
      <Popover.Trigger asChild disabled={props.disabled}>{props.trigger as any}</Popover.Trigger>
      <Popover.Portal>
        <Popover.Content align={props.align ?? "start"} sideOffset={4} onOpenAutoFocus={(e) => { if (!props.searchable) e.preventDefault(); }}
          className="z-50 w-60 overflow-hidden rounded-md border border-outline bg-popover text-sm text-ink shadow-lg outline-none">
          {props.searchable ? (
            <div className="flex items-center gap-2 border-b border-outline px-2.5 py-2">
              <Search className="size-3.5 text-ink-muted" />
              <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder={props.placeholder ?? "Search…"} className="w-full bg-transparent text-sm outline-none placeholder:text-ink-muted" />
            </div>
          ) : null}
          <div className="max-h-64 overflow-y-auto p-1" role="listbox">
            {!props.multiple && props.clearLabel ? (
              <button type="button" onClick={() => { props.onChange(null); setOpen(false); }} className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-ink-muted hover:bg-paper-grid">
                {props.clearLabel}{props.value === null ? <Check className="ml-auto size-3.5" /> : null}
              </button>
            ) : null}
            {shown.map((o) => (
              <button key={o.id} type="button" role="option" aria-selected={isSel(o.id)} onClick={() => pick(o.id)} className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left hover:bg-paper-grid">
                {o.icon}<span className="truncate">{o.label}</span>
                {o.hint ? <span className="ml-1 truncate text-xs text-ink-muted">{o.hint}</span> : null}
                {isSel(o.id) ? <Check className="ml-auto size-3.5 shrink-0" /> : null}
              </button>
            ))}
            {!shown.length ? <div className="px-2 py-3 text-center text-xs text-ink-muted">No matches</div> : null}
          </div>
          {props.footer ? <div className="border-t border-outline p-1">{props.footer}</div> : null}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

/** Plain popover with arbitrary content (date pickers, small forms). */
export function PopoverBox({ trigger, children, align = "start", width = "w-64" }: { trigger: ReactNode; children: ReactNode; align?: "start" | "end"; width?: string }) {
  return (
    <Popover.Root>
      <Popover.Trigger asChild>{trigger as any}</Popover.Trigger>
      <Popover.Portal>
        <Popover.Content align={align} sideOffset={4} className={`z-50 ${width} rounded-md border border-outline bg-popover p-3 text-sm text-ink shadow-lg outline-none`}>{children}</Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

export const triggerCls = "inline-flex min-h-7 max-w-full items-center gap-1.5 rounded-sm px-2 py-1 text-sm text-ink hover:bg-paper-grid focus-visible:outline-2 focus-visible:outline-ion-deep disabled:opacity-50";
