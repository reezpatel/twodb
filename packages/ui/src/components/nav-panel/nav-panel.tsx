import type {} from "styled-jsx";
import type { ReactNode } from "react";
import { navPanelStyles } from "./nav-panel.style";

export interface NavPanelProps {
	search?: ReactNode;
	children: ReactNode;
	className?: string;
	"aria-label"?: string;
}

export function NavPanel({
	search,
	children,
	className = "",
	"aria-label": ariaLabel,
}: NavPanelProps) {
	const classes = ["tw-navpanel", className].filter(Boolean).join(" ");

	return (
		<nav className={classes} aria-label={ariaLabel}>
			<style jsx>{navPanelStyles}</style>
			{search ? <div className="tw-navpanel__search">{search}</div> : null}
			{children}
		</nav>
	);
}
