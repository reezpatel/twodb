import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { overlayRootStyles } from "./overlay.style";

export interface OverlayProps {
	open: boolean;
	onClose: () => void;
	children: ReactNode;
	/** close when the dimmed backdrop is clicked (default true) */
	dismissOnBackdrop?: boolean;
	/** close on Escape (default true) */
	dismissOnEscape?: boolean;
}

/**
 * Overlay — portal-mounted layer above the app shell: a dimmed backdrop
 * plus arbitrary content on top. Handles Escape, backdrop dismiss and
 * body scroll locking; the content (dialog panel, sidenav, …) is supplied
 * by the caller.
 */
export function Overlay({
	open,
	onClose,
	children,
	dismissOnBackdrop = true,
	dismissOnEscape = true,
}: OverlayProps) {
	useEffect(() => {
		if (!open) return;
		const onKeyDown = (event: KeyboardEvent) => {
			if (dismissOnEscape && event.key === "Escape") onClose();
		};
		document.addEventListener("keydown", onKeyDown);
		const previousOverflow = document.body.style.overflow;
		document.body.style.overflow = "hidden";
		return () => {
			document.removeEventListener("keydown", onKeyDown);
			document.body.style.overflow = previousOverflow;
		};
	}, [open, onClose, dismissOnEscape]);

	if (!open || typeof document === "undefined") return null;

	return createPortal(
		<div className="tw-overlay-root">
			<style jsx>{overlayRootStyles}</style>
			<div
				className="tw-overlay-backdrop"
				aria-hidden
				onClick={dismissOnBackdrop ? onClose : undefined}
			/>
			{children}
		</div>,
		document.body,
	);
}
