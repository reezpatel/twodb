import type { InputHTMLAttributes } from "react";
import { Search } from "lucide-react";

export interface SearchInputProps extends InputHTMLAttributes<HTMLInputElement> {}

export function SearchInput({ className = "", ...rest }: SearchInputProps) {
  const classes = ["tw-input", className].filter(Boolean).join(" ");

  return (
    <span className="tw-search">
      <Search aria-hidden="true" />
      <input type="search" className={classes} {...rest} />
    </span>
  );
}
