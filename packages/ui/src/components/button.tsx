import type { ButtonHTMLAttributes, ReactNode } from "react";
import { buttonStyles } from "./button.style";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg" | "xl";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
	variant?: ButtonVariant;
	size?: ButtonSize;
	fullWidth?: boolean;
	children: ReactNode;
}

export function Button({
	variant = "primary",
	size = "md",
	fullWidth = false,
	className = "",
	children,
	...rest
}: ButtonProps) {
	const classes = [
		"tw-btn",
		`tw-btn--${variant}`,
		`tw-btn--${size}`,
		fullWidth ? "tw-btn--full" : "",
		className,
	]
		.filter(Boolean)
		.join(" ");

	return (
		<button className={classes} {...rest}>
			<style jsx>{buttonStyles}</style>
			{children}
		</button>
	);
}
