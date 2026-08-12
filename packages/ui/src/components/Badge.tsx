import type { HTMLAttributes, ReactNode } from "react";
import { badgeStyles } from "./Badge.style";

export type BadgeTone = "neutral" | "go" | "rose" | "warning" | "danger";

export type BadgeSize = "sm" | "md" | "lg";

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
  size?: BadgeSize;
  children: ReactNode;
}

export function Badge({ tone = "neutral", size = "md", className = "", children, ...rest }: BadgeProps) {
  const classes = ["tw-badge", `tw-badge--${tone}`, `tw-badge--${size}`, className]
    .filter(Boolean)
    .join(" ");

  return (
    <span className={classes} {...rest}>
      <style jsx>{badgeStyles}</style>
      {children}
    </span>
  );
}
