import type { ComponentProps } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export function ModelPanel({ className, ...props }: ComponentProps<"aside">) {
  return <aside data-slot="model-picker-panel" className={cn("flex w-56 shrink-0 flex-col gap-3 rounded-xl border p-3", className)} {...props} />;
}

export function ModelPanelTitle({ className, ...props }: ComponentProps<"div">) {
  return <div data-slot="model-picker-panel-title" className={cn("text-foreground text-sm font-semibold", className)} {...props} />;
}

export function ModelPanelText({ className, ...props }: ComponentProps<"p">) {
  return <p data-slot="model-picker-panel-text" className={cn("text-muted-foreground text-xs leading-relaxed text-pretty", className)} {...props} />;
}

type ModelSectionProps = Omit<ComponentProps<"div">, "title"> & {
  title: string;
};

export function ModelSection({ title, className, children, ...props }: ModelSectionProps) {
  return (
    <div data-slot="model-picker-section" className={cn("flex flex-col gap-1.5", className)} {...props}>
      <div className="text-muted-foreground/70 px-0.5 text-[10px] font-semibold tracking-wide uppercase">{title}</div>
      <div className="flex flex-col gap-0.5">{children}</div>
    </div>
  );
}

type ModelOptionProps = Omit<ComponentProps<"button">, "children"> & {
  label: string;
  selected?: boolean;
};

export function ModelOption({ label, selected = false, disabled, className, type = "button", ...props }: ModelOptionProps) {
  return (
    <button
      type={type}
      aria-pressed={selected}
      disabled={disabled}
      data-slot="model-picker-option"
      data-selected={selected || undefined}
      className={cn(
        "focus-visible:ring-ring flex w-full items-center justify-between gap-3 rounded-lg px-2.5 py-1.5 text-left text-xs font-medium transition-colors outline-none focus-visible:ring-2 disabled:pointer-events-none disabled:opacity-40",
        selected ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted/70 hover:text-foreground",
        className,
      )}
      {...props}
    >
      <span>{label}</span>
      <Check className={cn("size-3.5 shrink-0", !selected && "invisible")} aria-hidden="true" />
    </button>
  );
}

type ModelToggleProps = Omit<ComponentProps<"button">, "children"> & {
  label: string;
  selected?: boolean;
};

export function ModelToggle({ label, selected = false, disabled, className, type = "button", ...props }: ModelToggleProps) {
  return (
    <button
      type={type}
      aria-pressed={selected}
      disabled={disabled}
      data-slot="model-picker-toggle"
      data-selected={selected || undefined}
      className={cn(
        "focus-visible:ring-ring flex w-full items-center justify-between gap-3 rounded-lg px-2.5 py-1.5 text-left text-xs font-medium transition-colors outline-none focus-visible:ring-2 disabled:pointer-events-none disabled:opacity-40",
        selected ? "bg-muted text-foreground" : "text-muted-foreground/70 hover:bg-muted/70 hover:text-muted-foreground",
        className,
      )}
      {...props}
    >
      <span>{label}</span>
      <Check className={cn("size-3.5 shrink-0", !selected && "invisible")} aria-hidden="true" />
    </button>
  );
}

type ModelPanelMetaProps = Omit<ComponentProps<"div">, "title"> & {
  title: string;
  value: string;
};

export function ModelPanelMeta({ title, value, className, ...props }: ModelPanelMetaProps) {
  return (
    <div data-slot="model-picker-panel-meta" className={cn("mt-1 flex flex-col gap-1", className)} {...props}>
      <span className="text-muted-foreground/70 text-[10px] font-semibold tracking-wide uppercase">{title}</span>
      <span className="text-muted-foreground text-xs font-medium tabular-nums">{value}</span>
    </div>
  );
}
