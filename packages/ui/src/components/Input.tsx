import type { InputHTMLAttributes } from "react";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

export function Input({ label, id, className = "", ...rest }: InputProps) {
  const classes = ["tw-input", className].filter(Boolean).join(" ");
  const input = <input id={id} className={classes} {...rest} />;

  if (!label) return input;

  return (
    <label className="tw-field" htmlFor={id}>
      <span className="tw-field__label">{label}</span>
      {input}
    </label>
  );
}
