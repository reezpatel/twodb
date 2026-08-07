import type { HTMLAttributes, ReactNode } from "react";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  title?: string;
  children: ReactNode;
}

export function Card({ title, className = "", children, ...rest }: CardProps) {
  const classes = ["tw-card", className].filter(Boolean).join(" ");

  return (
    <div className={classes} {...rest}>
      {title ? <h3 className="tw-card__title">{title}</h3> : null}
      <div className="tw-card__body">{children}</div>
    </div>
  );
}
