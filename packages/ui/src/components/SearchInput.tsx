import type {} from "styled-jsx";
import type { InputHTMLAttributes } from "react";
import { Search } from "lucide-react";
import { searchInputStyles } from "./SearchInput.style";

export interface SearchInputProps
	extends InputHTMLAttributes<HTMLInputElement> {}

export function SearchInput({ className = "", ...rest }: SearchInputProps) {
	const classes = ["tw-input", className].filter(Boolean).join(" ");

	return (
		<span className="tw-search">
			<style jsx>{searchInputStyles}</style>
			<Search aria-hidden="true" />
			<input type="search" className={classes} {...rest} />
		</span>
	);
}
