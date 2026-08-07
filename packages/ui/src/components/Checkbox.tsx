import type { InputHTMLAttributes } from "react";

export interface CheckboxProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

export function Checkbox({ label, className = "", ...rest }: CheckboxProps) {
  const classes = ["tw-checkbox", className].filter(Boolean).join(" ");
  const box = <input type="checkbox" className={classes} {...rest} />;

  if (!label) return box;

  return (
    <label className="tw-choice">
      {box}
      <span>{label}</span>
    </label>
  );
}
