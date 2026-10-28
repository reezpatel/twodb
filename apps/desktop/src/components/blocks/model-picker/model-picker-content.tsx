import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";
import { PopoverContent } from "@/components/ui/popover";

export function ModelPickerContent({ className, side = "top", align = "start", ...props }: ComponentProps<typeof PopoverContent>) {
  return (
    <PopoverContent
      data-slot="model-picker-content"
      side={side}
      align={align}
      className={cn("flex w-auto items-start gap-2 rounded-2xl border-2 p-1.5", className)}
      {...props}
    />
  );
}

export function ModelPickerMain({ className, ...props }: ComponentProps<"div">) {
  return <div data-slot="model-picker-main" className={cn("flex min-w-64 flex-col", className)} {...props} />;
}
