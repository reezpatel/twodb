import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

type ModelLabelProps = ComponentProps<"span"> & {
  label: string;
  provider?: string;
  modifiers?: string[];
};

export function ModelLabel({ label, provider, modifiers = [], className, ...props }: ModelLabelProps) {
  return (
    <span data-slot="model-picker-label" className={cn("flex min-w-0 items-baseline gap-1.5", className)} {...props}>
      <span className="text-foreground truncate font-regular">
        {provider ? <span>{provider}/</span> : null}
        {label}
      </span>
      {modifiers.map((modifier) => (
        <span key={modifier} className="text-muted-foreground/70 shrink-0 font-medium tabular-nums">
          {modifier}
        </span>
      ))}
    </span>
  );
}
