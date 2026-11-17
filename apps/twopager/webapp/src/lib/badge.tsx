import type { ComponentProps } from "react";
import { Badge as BaseBadge, cn } from "@twodb/blocks";

type BadgeProps = ComponentProps<typeof BaseBadge>;

const capitalize = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);

/** Dispatch badge: a touch larger and lighter than the base, first letter capitalised. */
export function Badge({ className, children, ...props }: BadgeProps) {
  return (
    <BaseBadge className={cn("px-2 py-1 text-[12px] font-normal", className)} {...props}>
      {typeof children === "string" ? capitalize(children) : children}
    </BaseBadge>
  );
}
