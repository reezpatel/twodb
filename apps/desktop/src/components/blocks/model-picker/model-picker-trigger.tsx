import type { ComponentProps } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { ModelLabel } from "./model-picker-label";
import { useModelPickerContext } from "./model-picker-context";

type ModelPickerTriggerProps = Omit<ComponentProps<"button">, "children"> & {
  size?: "default" | "sm";
};

/** The default trigger. <ModelPicker> renders it when it has no children and wires it to the popover itself. */
export function ModelPickerTrigger({ size = "default", disabled, className, type = "button", ...props }: ModelPickerTriggerProps) {
  const context = useModelPickerContext();
  const label = context?.selected?.label ?? "Select model";
  const provider = context?.selected?.provider;
  const modifiers = context?.modifiers ?? [];

  return (
    <button
      type={type}
      disabled={disabled ?? context?.disabled}
      data-slot="model-picker-trigger"
      aria-label={`Model: ${[provider ? `${provider}/${label}` : label, ...modifiers].join(" ")}`}
      className={cn(
        "group text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-ring data-[state=open]:bg-muted data-[state=open]:text-foreground flex min-h-8 min-w-0 items-center gap-2 rounded-xl px-2.5 py-1 text-xs font-medium transition-colors outline-none focus-visible:ring-2 disabled:pointer-events-none disabled:opacity-40",
        size === "sm" && "min-h-6 rounded-lg px-1.5 py-0.5",
        className,
      )}
      {...props}
    >
      <ModelLabel label={label} provider={provider} modifiers={modifiers} className="text-xs" />
      <ChevronDown className="size-3.5 shrink-0 opacity-60 transition-transform group-data-[state=open]:rotate-180" aria-hidden="true" />
    </button>
  );
}
