import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";
import { cn } from "../../../lib/utils";

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-full border font-sans font-semibold tracking-normal whitespace-nowrap transition-colors outline-none active:translate-y-px focus-visible:outline-2 focus-visible:outline-ion-deep focus-visible:outline-offset-2 disabled:pointer-events-none disabled:opacity-45 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        primary: "border-ink bg-ink text-paper hover:bg-ink/90",
        secondary: "border-outline bg-stone text-ink hover:bg-paper-grid",
        ghost: "border-transparent bg-transparent text-ink hover:bg-stone",
        info: "border-info bg-info text-info-foreground hover:bg-info/90",
        danger: "border-destructive bg-destructive text-destructive-foreground hover:bg-destructive/90",
        success: "border-success bg-success text-success-foreground hover:bg-success/90",
        warning: "border-warning bg-warning text-warning-foreground hover:bg-warning/90",
      },
      size: {
        sm: "h-7 px-4 text-[13px] leading-5",
        md: "h-9 px-5 text-[15px] leading-5",
        lg: "h-11 px-6 text-[17px] leading-6",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  },
);

export interface ButtonProps extends React.ComponentProps<"button">, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

function Button({ className, variant = "primary", size = "md", asChild = false, ...props }: ButtonProps) {
  const Comp = asChild ? Slot.Root : "button";

  return <Comp data-slot="button" data-variant={variant} data-size={size} className={cn(buttonVariants({ variant, size, className }))} {...props} />;
}

export { Button, buttonVariants };
