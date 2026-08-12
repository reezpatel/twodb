import type {} from "styled-jsx";
import type { CSSProperties, ReactNode } from "react";
import {
	navPanelBadgeStyles,
	navPanelCountStyles,
	navPanelItemStyles,
} from "./NavPanelItem.style";

export interface NavPanelItemProps {
	icon?: ReactNode;
	label: ReactNode;
	meta?: ReactNode;
	color?: string;
	child?: boolean;
	active?: boolean;
	onClick?: () => void;
}

export function NavPanelItem({
	icon,
	label,
	meta,
	color,
	child,
	active,
	onClick,
}: NavPanelItemProps) {
	const classes = [
		"tw-navpanel__item",
		child ? "tw-navpanel__item--child" : "",
		active ? "is-active" : "",
	]
		.filter(Boolean)
		.join(" ");
	const style = color
		? ({ "--navpanel-item-color": color } as CSSProperties)
		: undefined;

	return (
		<button
			type="button"
			className={classes}
			style={style}
			aria-current={active ? "page" : undefined}
			onClick={onClick}
		>
			<style jsx>{navPanelItemStyles}</style>
			{icon || color ? (
				<span className="tw-navpanel__icon">
					{icon ?? <span className="tw-navpanel__dot" />}
				</span>
			) : null}
			<span className="tw-navpanel__label">{label}</span>
			{meta ? <span className="tw-navpanel__meta">{meta}</span> : null}
		</button>
	);
}

export function NavPanelCount({ children }: { children: ReactNode }) {
	return (
		<span className="tw-navpanel__count tw-tnum">
			<style jsx>{navPanelCountStyles}</style>
			{children}
		</span>
	);
}

export function NavPanelBadge({ children }: { children: ReactNode }) {
	return (
		<span className="tw-navpanel__badge">
			<style jsx>{navPanelBadgeStyles}</style>
			{children}
		</span>
	);
}
