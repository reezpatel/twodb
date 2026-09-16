import type { ReactNode } from "react";
import { Overlay } from "./overlay";
import { sidenavStyles } from "./sidenav.style";

export type SideNavFrom = "left" | "right";
export type SideNavWidth = "sm" | "md" | "lg";

export interface SideNavProps {
	open: boolean;
	onClose: () => void;
	/** edge the panel slides in from (default "right") */
	from?: SideNavFrom;
	/** panel width preset (default "md") */
	width?: SideNavWidth;
	title?: string;
	children: ReactNode;
	footer?: ReactNode;
}

/**
 * SideNav — a standardized edge panel built on Overlay. Slides in from the
 * given side, full height, width preset, with a header (title + close),
 * scrollable body and optional footer.
 */
export function SideNav({
	open,
	onClose,
	from = "right",
	width = "md",
	title,
	children,
	footer,
}: SideNavProps) {
	return (
		<Overlay open={open} onClose={onClose}>
			<div
				className={`tw-sidenav tw-sidenav--${from} tw-sidenav--${width}`}
				role="dialog"
				aria-modal="true"
				aria-label={title}
			>
				<style jsx>{sidenavStyles}</style>
				<div className="tw-sidenav__header">
					{title ? <h2 className="tw-sidenav__title">{title}</h2> : <span />}
					<button
						type="button"
						className="tw-sidenav__close"
						onClick={onClose}
						aria-label="Close panel"
					>
						<svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
							<path
								d="M2.5 2.5 9.5 9.5M9.5 2.5 2.5 9.5"
								stroke="currentColor"
								strokeWidth="1.5"
								strokeLinecap="round"
							/>
						</svg>
					</button>
				</div>
				<div className="tw-sidenav__body">{children}</div>
				{footer ? <div className="tw-sidenav__footer">{footer}</div> : null}
			</div>
		</Overlay>
	);
}
