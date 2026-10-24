import { useState, type ReactNode } from "react";
import { Check, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

// Linear-style field controls: a Pill trigger + PopoverPick searchable list,
// modeled on itsaplan's components/common/fields.

/** A rounded muted trigger with icon + label. Never grows past its column. */
export function Pill({ active, children, className, ...props }: { active?: boolean } & React.ComponentProps<"button">) {
  return (
    <button
      type="button"
      className={cn(
        "hover:bg-accent flex h-7 max-w-full min-w-0 items-center gap-1.5 rounded-full border px-2.5 text-sm transition-colors [&_svg:not([class*='size-'])]:size-3.5 [&>svg]:shrink-0",
        active ? "text-foreground" : "text-muted-foreground",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function colorDot(color: string) {
  return <span className="inline-block size-2.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />;
}

export interface PickItem {
  key: string;
  search: string;
  icon?: ReactNode;
  label: string;
  selected?: boolean;
  trailing?: ReactNode;
  onSelect: () => void;
}

/** A Pill trigger opening a searchable item list in a popover. */
export function PopoverPick({
  trigger,
  inputPlaceholder,
  emptyText = "No results",
  items,
  closeOnSelect = true,
  contentClassName = "w-56",
  align = "start",
}: {
  trigger: ReactNode;
  inputPlaceholder: string;
  emptyText?: string;
  items: PickItem[];
  closeOnSelect?: boolean;
  contentClassName?: string;
  align?: "start" | "center" | "end";
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const filtered = items.filter((it) => it.search.toLowerCase().includes(query.toLowerCase()));
  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setQuery("");
      }}
    >
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent align={align} className={cn("p-0", contentClassName)}>
        <div className="flex items-center gap-2 border-b px-2.5 py-2">
          <Search size={12} className="text-muted-foreground shrink-0" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={inputPlaceholder}
            className="h-6 border-0 px-0 text-xs shadow-none focus-visible:ring-0"
          />
        </div>
        <div className="max-h-64 overflow-y-auto p-1">
          {filtered.length === 0 && <p className="text-muted-foreground px-2 py-3 text-center text-xs">{emptyText}</p>}
          {filtered.map((it) => (
            <button
              key={it.key}
              className="hover:bg-accent flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm"
              onClick={() => {
                it.onSelect();
                if (closeOnSelect) setOpen(false);
              }}
            >
              {it.icon}
              <span className="min-w-0 flex-1 truncate">{it.label}</span>
              {it.trailing}
              {it.selected && <Check size={13} className="text-primary shrink-0" />}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

/** Two-cell property row — label column + control column (itsaplan's IssuePropertyRow). */
export function PropertyRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <div className="text-muted-foreground truncate pt-1.5 text-sm" title={label}>
        {label}
      </div>
      <div className="min-w-0">{children}</div>
    </>
  );
}

/** The grid the PropertyRows slot into. */
export function PropertiesGrid({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-[minmax(90px,120px)_1fr] items-start gap-x-3 gap-y-1">{children}</div>;
}
