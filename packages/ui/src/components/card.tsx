import type { HTMLAttributes, ReactNode } from "react";
import { cardStyles } from "./card.style";

export type CardTone = "default" | "band" | "rose" | "warning" | "danger";
export type CardDensity = "normal" | "compact";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
	title?: string;
	actions?: ReactNode;
	tone?: CardTone;
	density?: CardDensity;
	children: ReactNode;
}

export function Card({
	title,
	actions,
	tone = "default",
	density = "normal",
	className = "",
	children,
	...rest
}: CardProps) {
	const classes = [
		"tw-card",
		`tw-card--${tone}`,
		`tw-card--${density}`,
		className,
	]
		.filter(Boolean)
		.join(" ");

	return (
		<div className={classes} {...rest}>
			<style jsx>{cardStyles}</style>
			{title || actions ? (
				<div className="tw-card__header">
					{title ? <h3 className="tw-card__title">{title}</h3> : <span />}
					{actions}
				</div>
			) : null}
			<div className="tw-card__body">{children}</div>
		</div>
	);
}
