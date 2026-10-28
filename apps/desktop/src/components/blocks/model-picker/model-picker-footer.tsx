import type { ComponentProps } from "react";
import { ChevronRight, LayoutGrid } from "lucide-react";
import { cn } from "@/lib/utils";

export function ModelPickerFooter({ className, ...props }: ComponentProps<"div">) {
  return <div data-slot="model-picker-footer" className={cn("mt-1 border-t pt-1", className)} {...props} />;
}

type ModelPickerShowAllProps = Omit<ComponentProps<"button">, "children"> & {
  count?: number;
  label?: string;
};

export function ModelPickerShowAll({ count, label = "Show all models", className, type = "button", ...props }: ModelPickerShowAllProps) {
  return (
    <button
      type={type}
      data-slot="model-picker-show-all"
      className={cn(
        "text-muted-foreground hover:bg-muted/70 hover:text-foreground focus-visible:ring-ring flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left text-sm font-medium transition-colors outline-none focus-visible:ring-2",
        className,
      )}
      {...props}
    >
      <LayoutGrid className="size-3.5 shrink-0" aria-hidden="true" />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {count !== undefined ? <span className="text-muted-foreground/70 tabular-nums">{count.toLocaleString()}</span> : null}
      <ChevronRight className="size-3.5 shrink-0 opacity-60" aria-hidden="true" />
    </button>
  );
}
