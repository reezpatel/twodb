import type { InputHTMLAttributes } from "react";
import { useId } from "react";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string;
}

export function Input({ label, hint, error, id, className = "", ...rest }: InputProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const classes = ["tw-input", className].filter(Boolean).join(" ");

  const input = (
    <input id={inputId} className={classes} aria-invalid={error ? true : undefined} {...rest} />
  );

  if (!label && !hint && !error) return input;

  return (
    <div className="tw-field">
      {label ? (
        <label className="tw-field__label" htmlFor={inputId}>
          {label}
        </label>
      ) : null}
      {input}
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
