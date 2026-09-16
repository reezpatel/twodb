import type {} from "styled-jsx";
import { useId, type HTMLAttributes, type ReactNode } from "react";
import { emptyStateStyles } from "./empty-state.style";

export type EmptyStateIconTone = "neutral" | "accent";

export interface EmptyStateProps
	extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
	icon?: ReactNode;
	iconTone?: EmptyStateIconTone;
	title: ReactNode;
	description?: ReactNode;
	action?: ReactNode;
}

export function EmptyState({
	icon,
	iconTone = "neutral",
	title,
	description,
	action,
	className = "",
	...rest
}: EmptyStateProps) {
	const titleId = useId();
	const classes = ["tw-empty", `tw-empty--${iconTone}`, className]
		.filter(Boolean)
		.join(" ");

	return (
		<div className={classes} aria-labelledby={titleId} {...rest}>
			<style jsx>{emptyStateStyles}</style>
			{icon ? <div className="tw-empty__icon">{icon}</div> : null}
			<h2 className="tw-empty__title" id={titleId}>
				{title}
			</h2>
			{description ? (
				<div className="tw-empty__description">{description}</div>
			) : null}
			{action ? <div className="tw-empty__action">{action}</div> : null}
		</div>
	);
}
