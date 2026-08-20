import { useId, type TextareaHTMLAttributes } from "react";
import { fieldStyles } from "./field.style";

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  hint?: string;
  error?: string;
}

export function Textarea({ label, hint, error, id, className = "", ...rest }: TextareaProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const classes = ["tw-textarea", className].filter(Boolean).join(" ");

  // Keep <textarea> lexically inside the tree that carries <style jsx>:
  // styled-jsx only scopes elements written in the same JSX tree.
  if (!label && !hint && !error) {
    return (
      <>
        <textarea id={inputId} className={classes} aria-invalid={error ? true : undefined} {...rest} />
        <style jsx>{fieldStyles}</style>
      </>
    );
  }

  return (
    <div className="tw-field">
      <style jsx>{fieldStyles}</style>
      {label ? (
        <label className="tw-field__label" htmlFor={inputId}>
          {label}
        </label>
      ) : null}
      <textarea id={inputId} className={classes} aria-invalid={error ? true : undefined} {...rest} />
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
