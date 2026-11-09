import type { ComponentProps, ReactNode } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const footerWidgetVariants = cva("flex h-6 shrink-0 items-center justify-center gap-2 px-2 transition-colors outline-none", {
  variants: {
    variant: {
      default: "text-muted-foreground hover:text-foreground",
      primary: "bg-primary text-primary-foreground hover:bg-primary/90",
      secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
      info: "bg-info text-background hover:bg-info/90",
      warn: "bg-warning text-warning-foreground hover:bg-warning/90",
      error: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
      success: "bg-success text-success-foreground hover:bg-success/90",
      inverse: "bg-foreground text-background hover:bg-foreground/90",
    },
  },
  defaultVariants: {
    variant: "default",
  },
});

type FooterWidgetProps = ComponentProps<"button"> &
  VariantProps<typeof footerWidgetVariants> & {
    icon: ReactNode;
  };

export function FooterWidget({ icon, variant = "default", className, children, type = "button", ...props }: FooterWidgetProps) {
  return (
    <button type={type} data-slot="footer-widget" data-variant={variant} className={cn(footerWidgetVariants({ variant }), className)} {...props}>
      <span className="flex shrink-0 items-center" aria-hidden="true">
        {icon}
      </span>
      {children ? <span className="hidden min-w-0 items-center gap-2 lg:flex">{children}</span> : null}
    </button>
  );
}

export { footerWidgetVariants };
