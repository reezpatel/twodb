import type { HTMLAttributes, ReactNode } from "react";
import { kbdStyles } from "./kbd.style";

export interface KbdProps extends HTMLAttributes<HTMLElement> {
	children: ReactNode;
}

/**
 * Kbd — a keycap chip for keyboard hints. A hairline key with a
 * deepened bottom edge, so it reads as a physical key sitting on
 * the surface. Use in footers, menus, and command palettes.
 */
export function Kbd({ children, className = "", ...rest }: KbdProps) {
	const classes = ["tw-kbd", className].filter(Boolean).join(" ");
	return (
		<kbd className={classes} {...rest}>
			<style jsx>{kbdStyles}</style>
			{children}
		</kbd>
	);
}
