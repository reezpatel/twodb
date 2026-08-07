import { useEffect, useRef, type InputHTMLAttributes } from "react";

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  label?: string;
  /** Mixed state — some, but not all, of a group selected. */
  indeterminate?: boolean;
}

export function Checkbox({ label, indeterminate, className = "", ...rest }: CheckboxProps) {
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (ref.current) ref.current.indeterminate = !!indeterminate;
  }, [indeterminate]);

  const control = (
    <span className="tw-checkbox">
      <input ref={ref} type="checkbox" className={className} {...rest} />
      <span className="tw-checkbox__box" aria-hidden="true">
        <svg viewBox="0 0 12 12" className="tw-checkbox__mark">
          <path
            d="M2 6.2 4.8 9 10 3.2"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <svg viewBox="0 0 12 12" className="tw-checkbox__dash">
          <path
            d="M2.5 6h7"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>
      </span>
    </span>
  );

  if (!label) return control;

  return (
    <label className="tw-choice">
      {control}
      <span>{label}</span>
    </label>
  );
}
