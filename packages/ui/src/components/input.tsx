import type { InputHTMLAttributes } from "react";
import { useId } from "react";
import { fieldStyles } from "./field.style";

export type InputSize = "sm" | "md" | "lg";

export interface InputProps
	extends Omit<InputHTMLAttributes<HTMLInputElement>, "size"> {
	label?: string;
	hint?: string;
	error?: string;
	size?: InputSize;
}

export function Input({
	label,
	hint,
	error,
	id,
	size = "md",
	className = "",
	...rest
}: InputProps) {
	const autoId = useId();
	const inputId = id ?? autoId;
	const classes = ["tw-input", `tw-input--${size}`, className]
		.filter(Boolean)
		.join(" ");

	// Keep <input> lexically inside the tree that carries <style jsx>:
	// styled-jsx only scopes elements written in the same JSX tree.
	if (!label && !hint && !error) {
		return (
			<>
				<input
					id={inputId}
					className={classes}
					aria-invalid={error ? true : undefined}
					{...rest}
				/>
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
			<input
				id={inputId}
				className={classes}
				aria-invalid={error ? true : undefined}
				{...rest}
			/>
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
