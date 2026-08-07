import type { ButtonHTMLAttributes, ReactNode } from "react";

export type IconButtonVariant = "ghost" | "secondary";
export type IconButtonSize = "sm" | "md" | "lg";

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Accessible name — required, since the button has no visible text. */
  label: string;
  icon: ReactNode;
  variant?: IconButtonVariant;
  size?: IconButtonSize;
}

export function IconButton({
  label,
  icon,
  variant = "ghost",
  size = "md",
  className = "",
  ...rest
}: IconButtonProps) {
  const classes = ["tw-icon-btn", `tw-icon-btn--${variant}`, `tw-icon-btn--${size}`, className]
    .filter(Boolean)
    .join(" ");

  return (
    <button type="button" className={classes} aria-label={label} title={label} {...rest}>
      {icon}
    </button>
  );
}
