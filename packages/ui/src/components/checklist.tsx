import {
	useEffect,
	useRef,
	type InputHTMLAttributes,
	type ReactNode,
} from "react";
import { checklistStyles } from "./checklist.style";

export type ChecklistPriority = 0 | 1 | 2 | 3;

export interface CheckItemProps
	extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
	label: ReactNode;
	description?: ReactNode;
	priority?: ChecklistPriority;
	indeterminate?: boolean;
}

export interface ChecklistProps {
	children: ReactNode;
	className?: string;
	"aria-label"?: string;
	"aria-labelledby"?: string;
}

export function CheckItem({
	label,
	description,
	priority = 0,
	indeterminate,
	className = "",
	...rest
}: CheckItemProps) {
	const ref = useRef<HTMLInputElement>(null);
	const classes = ["tw-checkitem", `tw-checkitem--p${priority}`, className]
		.filter(Boolean)
		.join(" ");

	useEffect(() => {
		if (ref.current) ref.current.indeterminate = !!indeterminate;
	}, [indeterminate]);

	return (
		<label className={classes}>
			<style jsx>{checklistStyles}</style>
			<input
				ref={ref}
				type="checkbox"
				className="tw-checkitem__input"
				{...rest}
			/>
			<span className="tw-checkitem__box" aria-hidden="true">
				{indeterminate ? (
					<svg viewBox="0 0 12 12" className="tw-checkitem__mark">
						<path
							d="M2.5 6h7"
							fill="none"
							stroke="currentColor"
							strokeWidth="1.8"
							strokeLinecap="round"
						/>
					</svg>
				) : (
					<svg viewBox="0 0 12 12" className="tw-checkitem__mark">
						<path
							d="M2 6.2 4.8 9 10 3.2"
							fill="none"
							stroke="currentColor"
							strokeWidth="1.8"
							strokeLinecap="round"
							strokeLinejoin="round"
						/>
					</svg>
				)}
			</span>
			<span className="tw-checkitem__content">
				<span className="tw-checkitem__label">{label}</span>
				{description ? (
					<span className="tw-checkitem__description">{description}</span>
				) : null}
			</span>
		</label>
	);
}

export function Checklist({
	children,
	className = "",
	...rest
}: ChecklistProps) {
	const classes = ["tw-checklist", className].filter(Boolean).join(" ");

	return (
		<div className={classes} {...rest}>
			<style jsx>{checklistStyles}</style>
			{children}
		</div>
	);
}
