import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";

export function NavRailSeparator({ className, ...props }: ComponentProps<typeof Separator>) {
  return <Separator data-slot="nav-rail-separator" className={cn("my-1 w-5", className)} {...props} />;
}
