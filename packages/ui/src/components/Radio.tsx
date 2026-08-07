import type { InputHTMLAttributes } from "react";

export interface RadioProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

export function Radio({ label, className = "", ...rest }: RadioProps) {
  const classes = ["tw-radio", className].filter(Boolean).join(" ");
  const radio = <input type="radio" className={classes} {...rest} />;

  if (!label) return radio;

  return (
    <label className="tw-choice">
      {radio}
      <span>{label}</span>
    </label>
  );
}
