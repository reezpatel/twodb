import type { HTMLAttributes, ReactNode } from "react";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  title?: string;
  actions?: ReactNode;
  children: ReactNode;
}

export function Card({ title, actions, className = "", children, ...rest }: CardProps) {
  const classes = ["tw-card", className].filter(Boolean).join(" ");

  return (
    <div className={classes} {...rest}>
      {title || actions ? (
        <div className="tw-card__header">
          {title ? <h3 className="tw-card__title">{title}</h3> : <span />}
          {actions}
        </div>
      ) : null}
      <div className="tw-card__body">{children}</div>
    </div>
  );
}
