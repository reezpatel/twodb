import type { ComponentProps } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const dotVariants = cva("inline-block size-2 shrink-0 rounded-full", {
  variants: {
    status: {
      live: "bg-success",
      connecting: "bg-warning animate-pulse",
      offline: "bg-destructive",
    },
  },
  defaultVariants: { status: "offline" },
});

const textVariants = cva("text-xs font-medium", {
  variants: {
    status: {
      live: "text-success",
      connecting: "text-warning",
      offline: "text-destructive",
    },
  },
  defaultVariants: { status: "offline" },
});

type CodeHeaderStatusProps = Omit<ComponentProps<"span">, "children"> &
  VariantProps<typeof dotVariants> & {
    label: string;
  };

export function CodeHeaderStatus({ status, label, className, ...props }: CodeHeaderStatusProps) {
  if (status === "live") return null;

  return (
    <span
      data-slot="code-header-status"
      data-status={status}
      role="status"
      title={label}
      className={cn("flex shrink-0 items-center gap-1.5 px-1", className)}
      {...props}
    >
      <span className={dotVariants({ status })} aria-hidden="true" />
      <span className={textVariants({ status })}>{label}</span>
    </span>
  );
}
