import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";

export function CodeHeaderSeparator({ className, ...props }: Omit<ComponentProps<typeof Separator>, "orientation">) {
  return (
    <Separator
      data-slot="code-header-separator"
      orientation="vertical"
      className={cn("mx-1 data-[orientation=vertical]:h-4 has-[+[data-slot=code-header-widgets]:empty]:hidden", className)}
      {...props}
    />
  );
}
