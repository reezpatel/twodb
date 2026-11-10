import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../../lib/utils";

export const BADGE_TONES = ["info", "danger", "success", "warning", "neutral"] as const;
export type BadgeTone = (typeof BADGE_TONES)[number];

/**
 * Badge — a subtler, squarer sibling of Chip for inline metadata (provider
 * tags, space names, model markers) where the Chip's pill shape and 15px
 * weight read too loud. Static by design (no button semantics): metadata
 * labels aren't interactive.
 */
const badgeVariants = cva(
  "inline-flex shrink-0 items-center gap-1 rounded-[4px] border px-1.5 py-0.5 font-sans text-[11px] font-medium leading-none transition-colors disabled:pointer-events-none disabled:opacity-45",
  {
    variants: {
      tone: {
        neutral: "border-stone-hatch bg-paper text-ink-muted",
        info: "border-info/25 bg-info/[0.07] text-info",
        danger: "border-destructive/25 bg-destructive/[0.07] text-destructive",
        success: "border-success/25 bg-success/[0.07] text-success",
        warning: "border-warning/25 bg-warning/[0.07] text-warning",
      },
    },
    defaultVariants: {
      tone: "neutral",
    },
  },
);

export interface BadgeProps extends Omit<React.ComponentProps<"span">, "children">, VariantProps<typeof badgeVariants> {
  /** Optional leading glyph — an icon, a dot, anything small. */
  icon?: React.ReactNode;
  children?: React.ReactNode;
}

function Badge({ className, tone = "neutral", icon, children, ...props }: BadgeProps) {
  return (
    <span data-slot="badge" className={cn(badgeVariants({ tone }), className)} {...props}>
      {icon ? (
        <span aria-hidden className="flex size-3 shrink-0 items-center justify-center [&_svg]:size-3">
          {icon}
        </span>
      ) : null}
      {children}
    </span>
  );
}

export { Badge, badgeVariants };
