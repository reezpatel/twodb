import type { InputHTMLAttributes } from "react";
import { fieldStyles } from "./Field.style";

export interface RadioProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

export function Radio({ label, className = "", ...rest }: RadioProps) {
  const classes = ["tw-radio", className].filter(Boolean).join(" ");
  const radio = (
    <>
      <input type="radio" className={classes} {...rest} />
      <style jsx>{fieldStyles}</style>
    </>
  );

  if (!label) return radio;

  return (
    <label className="tw-choice">
      <style jsx>{fieldStyles}</style>
      {radio}
      <span>{label}</span>
    </label>
  );
}
