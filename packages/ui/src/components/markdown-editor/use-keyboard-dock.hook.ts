import { useEffect, useState, type CSSProperties, type RefObject } from "react";

/**
 * Mobile keyboard dock: while the editor is focused and the on-screen
 * keyboard shrinks the visual viewport, pin the toolbar just above it.
 * Returns null when the keyboard is closed (toolbar stays in flow).
 */
export function useKeyboardDock(
	active: boolean,
	anchorRef: RefObject<HTMLElement | null>,
): CSSProperties | null {
	const [dock, setDock] = useState<CSSProperties | null>(null);

	useEffect(() => {
		const vv = window.visualViewport;
		if (!active || !vv) {
			setDock(null);
			return;
		}

		const update = () => {
			const anchor = anchorRef.current;
			if (!anchor) return;
			const keyboardHeight = window.innerHeight - (vv.height + vv.offsetTop);
			if (keyboardHeight < 80) {
				setDock(null);
				return;
			}
			const rect = anchor.getBoundingClientRect();
			setDock({
				position: "fixed",
				left: rect.left,
				width: rect.width,
				bottom: keyboardHeight,
				zIndex: 70,
			});
		};

		update();
		vv.addEventListener("resize", update);
		vv.addEventListener("scroll", update);
		window.addEventListener("scroll", update, true);
		return () => {
			vv.removeEventListener("resize", update);
			vv.removeEventListener("scroll", update);
			window.removeEventListener("scroll", update, true);
		};
	}, [active, anchorRef]);

	return dock;
}
