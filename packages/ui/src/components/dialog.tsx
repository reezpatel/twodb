import { useEffect, useRef, type ReactNode } from "react";
import { overlayStyles } from "./overlay.style";

export interface DialogProps {
	open: boolean;
	onClose: () => void;
	title?: string;
	children: ReactNode;
	footer?: ReactNode;
}

export function Dialog({
	open,
	onClose,
	title,
	children,
	footer,
}: DialogProps) {
	const ref = useRef<HTMLDialogElement>(null);

	useEffect(() => {
		const dialog = ref.current;
		if (!dialog) return;
		if (open && !dialog.open) dialog.showModal();
		if (!open && dialog.open) dialog.close();
	}, [open]);

	return (
		<dialog
			ref={ref}
			className="tw-dialog"
			onClose={onClose}
			onClick={(e) => {
				if (e.target === ref.current) onClose();
			}}
		>
			<style jsx>{overlayStyles}</style>
			{title ? (
				<div className="tw-dialog__header">
					<h2 className="tw-dialog__title">{title}</h2>
					<button
						type="button"
						className="tw-dialog__close"
						onClick={onClose}
						aria-label="Close dialog"
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
			) : null}
			<div className="tw-dialog__body">{children}</div>
			{footer ? <div className="tw-dialog__footer">{footer}</div> : null}
		</dialog>
	);
}
