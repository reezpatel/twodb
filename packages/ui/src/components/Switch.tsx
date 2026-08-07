import type { InputHTMLAttributes } from "react";

export interface SwitchProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  label?: string;
}

export function Switch({ label, className = "", ...rest }: SwitchProps) {
  const classes = ["tw-switch", className].filter(Boolean).join(" ");
  const control = <input type="checkbox" role="switch" className={classes} {...rest} />;

  if (!label) return control;

  return (
    <label className="tw-choice">
      {control}
      <span>{label}</span>
    </label>
  );
}
