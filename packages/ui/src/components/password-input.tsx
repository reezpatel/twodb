import { useId, useState, type InputHTMLAttributes } from "react";
import { Eye, EyeOff } from "lucide-react";
import { IconButton } from "./icon-button";
import { fieldStyles } from "./field.style";

export interface PasswordInputProps
	extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
	label?: string;
	hint?: string;
	error?: string;
}

export function PasswordInput({
	label,
	hint,
	error,
	id,
	className = "",
	...rest
}: PasswordInputProps) {
	const autoId = useId();
	const inputId = id ?? autoId;
	const [show, setShow] = useState(false);

	const input = (
		<span className="tw-pass">
			<style jsx>{fieldStyles}</style>
			<input
				id={inputId}
				type={show ? "text" : "password"}
				className={["tw-input", className].filter(Boolean).join(" ")}
				aria-invalid={error ? true : undefined}
				{...rest}
			/>
			<IconButton
				size="sm"
				label={show ? "Hide password" : "Show password"}
				icon={show ? <EyeOff /> : <Eye />}
				onClick={() => setShow((s) => !s)}
				tabIndex={-1}
			/>
		</span>
	);

	if (!label && !hint && !error) return input;

	return (
		<div className="tw-field">
			<style jsx>{fieldStyles}</style>
			{label ? (
				<label className="tw-field__label" htmlFor={inputId}>
					{label}
				</label>
			) : null}
			{input}
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
