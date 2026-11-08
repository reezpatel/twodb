import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

export const CHIP_ZONES = ["ion", "tritium", "transmute", "materials"] as const;
export type ChipZone = (typeof CHIP_ZONES)[number];

export const CHIP_TONES = ["info", "danger", "success", "warning"] as const;
export type ChipTone = (typeof CHIP_TONES)[number];

const zoneDotClass: Record<ChipZone, string> = {
  ion: "bg-ion",
  tritium: "bg-tritium",
  transmute: "bg-transmute",
  materials: "bg-materials",
};

const toneDotClass: Record<ChipTone, string> = {
  info: "bg-info",
  danger: "bg-destructive",
  success: "bg-success",
  warning: "bg-warning",
};

const chipVariants = cva(
  "inline-flex shrink-0 items-center gap-2 rounded-full border font-sans text-[15px] font-medium leading-5 pl-3 pr-4 py-1 transition-colors outline-none focus-visible:outline-2 focus-visible:outline-ion-deep focus-visible:outline-offset-2 disabled:pointer-events-none disabled:opacity-45",
  {
    variants: {
      selected: {
        true: "border-outline bg-stone text-ink",
        false: "border-stone-hatch bg-paper text-ink-muted hover:bg-paper-grid",
      },
      tone: {
        none: "",
        info: "border-info/40 bg-info/10 text-info hover:bg-info/15",
        danger: "border-destructive/40 bg-destructive/10 text-destructive hover:bg-destructive/15",
        success: "border-success/40 bg-success/10 text-success hover:bg-success/15",
        warning: "border-warning/40 bg-warning/10 text-warning hover:bg-warning/15",
      },
    },
    defaultVariants: {
      selected: false,
      tone: "none",
    },
  },
);

export interface ChipProps extends React.ComponentProps<"button">, VariantProps<typeof chipVariants> {
  /** Zone colour dot used for part/filter chips (Ion beam, Tritium target, ...). */
  zone?: ChipZone;
  /** Status tone used for semantic chips (info/danger/success/warning). Overrides selected styling. */
  tone?: ChipTone | "none";
  /** Show the zone/tone dot. Defaults to true when zone or tone is set. */
  dot?: boolean;
}

function Chip({ className, zone, tone = "none", selected = false, dot, children, ...props }: ChipProps) {
  const hasTone = tone !== "none" && tone !== undefined;
  const showDot = dot ?? Boolean(zone || hasTone);
  const dotClass = hasTone ? toneDotClass[tone as ChipTone] : zone ? zoneDotClass[zone] : undefined;

  return (
    <button
      type="button"
      data-slot="chip"
      aria-pressed={hasTone ? undefined : !!selected}
      className={cn(chipVariants({ selected: hasTone ? false : selected, tone, className }))}
      {...props}
    >
      {showDot && dotClass ? <span aria-hidden className={cn("size-3 shrink-0 rounded-full border border-outline", dotClass)} /> : null}
      {children}
    </button>
  );
}

export { Chip, chipVariants };
