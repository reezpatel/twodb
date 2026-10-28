import type { ComponentProps, ReactNode } from "react";
import { Check, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
import { ModelLabel } from "./model-picker-label";

export function ModelList({ className, ...props }: ComponentProps<"div">) {
  return <div data-slot="model-picker-list" role="listbox" className={cn("flex max-h-80 min-w-64 flex-col gap-0.5 overflow-y-auto", className)} {...props} />;
}

export function ModelListEmpty({ className, ...props }: ComponentProps<"p">) {
  return <p data-slot="model-picker-list-empty" className={cn("text-muted-foreground px-3 py-6 text-center text-xs", className)} {...props} />;
}

type ModelItemProps = Omit<ComponentProps<"div">, "children"> & {
  label: string;
  provider?: string;
  modifiers?: string[];
  icon?: ReactNode;
  badge?: string;
  selected?: boolean;
  editing?: boolean;
  disabled?: boolean;
  editLabel?: string;
  onSelect?: () => void;
  onEdit?: () => void;
};

export function ModelItem({
  label,
  provider,
  modifiers,
  icon,
  badge,
  selected = false,
  editing = false,
  disabled = false,
  editLabel,
  onSelect,
  onEdit,
  className,
  ...props
}: ModelItemProps) {
  return (
    <div
      data-slot="model-picker-item"
      data-selected={selected || undefined}
      data-editing={editing || undefined}
      className={cn(
        "group/item relative flex items-center gap-1 rounded-xl transition-colors",
        selected ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted/50",
        editing && "bg-muted/80",
        disabled && "pointer-events-none opacity-40",
        className,
      )}
      {...props}
    >
      <button
        type="button"
        role="option"
        aria-selected={selected}
        disabled={disabled}
        onClick={onSelect}
        className="focus-visible:ring-ring flex min-w-0 flex-1 items-center gap-2 rounded-xl px-2.5 py-2 text-left outline-none focus-visible:ring-2"
      >
        {icon ? <span className="shrink-0 [&_svg:not([class*='size-'])]:size-4">{icon}</span> : null}
        <ModelLabel label={label} provider={provider} modifiers={modifiers} className="min-w-0 flex-1 text-sm" />
        {badge ? <span className="bg-muted text-muted-foreground shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium">{badge}</span> : null}
        <Check className={cn("text-foreground size-3.5 shrink-0", !selected && "invisible")} aria-hidden="true" />
      </button>
      {onEdit ? (
        <button
          type="button"
          aria-label={editLabel ?? `Edit ${provider ? `${provider}/` : ""}${label} settings`}
          aria-expanded={editing}
          disabled={disabled}
          onClick={onEdit}
          className={cn(
            "text-muted-foreground/70 hover:bg-accent hover:text-foreground focus-visible:ring-ring mr-1 flex size-7 shrink-0 items-center justify-center rounded-lg opacity-0 transition-opacity outline-none group-hover/item:opacity-100 focus-visible:opacity-100 focus-visible:ring-2 max-lg:opacity-100",
            editing && "bg-accent text-foreground opacity-100",
          )}
        >
          <Pencil className="size-3.5" aria-hidden="true" />
        </button>
      ) : null}
    </div>
  );
}
