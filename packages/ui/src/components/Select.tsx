import { useId, type SelectHTMLAttributes } from "react";

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  hint?: string;
  error?: string;
}

export function Select({ label, hint, error, id, className = "", children, ...rest }: SelectProps) {
  const autoId = useId();
  const selectId = id ?? autoId;
  const classes = ["tw-select", className].filter(Boolean).join(" ");

  const select = (
    <select id={selectId} className={classes} aria-invalid={error ? true : undefined} {...rest}>
      {children}
    </select>
  );

  if (!label && !hint && !error) return select;

  return (
    <div className="tw-field">
      {label ? (
        <label className="tw-field__label" htmlFor={selectId}>
          {label}
        </label>
      ) : null}
      {select}
      {error ? (
        <span className="tw-field__error" role="alert">
          {error}
        </span>
      ) : hint ? (
        <span className="tw-field__hint">{hint}</span>
      ) : null}
    </div>
  );
}
