import {
	createContext,
	useContext,
	useEffect,
	useRef,
	useState,
	cloneElement,
	isValidElement,
	type MouseEvent,
	type ReactElement,
	type ReactNode,
} from "react";
import { overlayStyles } from "./Overlay.style";

export type MenuPlacement =
	| "top-start"
	| "top-end"
	| "bottom-start"
	| "bottom-end";

const MenuCloseContext = createContext<() => void>(() => {});

export interface MenuProps {
	trigger: ReactElement;
	placement?: MenuPlacement;
	children: ReactNode;
}

export function Menu({
	trigger,
	placement = "bottom-start",
	children,
}: MenuProps) {
	const [open, setOpen] = useState(false);
	const anchorRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (!open) return;
		const onPointerDown = (e: globalThis.MouseEvent) => {
			if (!anchorRef.current?.contains(e.target as Node)) setOpen(false);
		};
		const onKeyDown = (e: KeyboardEvent) => {
			if (e.key === "Escape") setOpen(false);
		};
		document.addEventListener("mousedown", onPointerDown);
		document.addEventListener("keydown", onKeyDown);
		return () => {
			document.removeEventListener("mousedown", onPointerDown);
			document.removeEventListener("keydown", onKeyDown);
		};
	}, [open]);

	const wiredTrigger = isValidElement(trigger)
		? cloneElement(trigger as ReactElement<Record<string, unknown>>, {
				onClick: () => setOpen((o) => !o),
				"aria-expanded": open,
				"aria-haspopup": "menu",
			})
		: trigger;

	return (
		<div className="tw-menu-anchor" ref={anchorRef}>
			<style jsx>{overlayStyles}</style>
			{wiredTrigger}
			{open ? (
				<div className={`tw-menu tw-menu--${placement}`} role="menu">
					<MenuCloseContext.Provider value={() => setOpen(false)}>
						{children}
					</MenuCloseContext.Provider>
				</div>
			) : null}
		</div>
	);
}

export interface MenuItemProps {
	icon?: ReactNode;
	danger?: boolean;
	onClick?: (e: MouseEvent<HTMLButtonElement>) => void;
	children: ReactNode;
}

export function MenuItem({ icon, danger, onClick, children }: MenuItemProps) {
	const close = useContext(MenuCloseContext);
	const classes = ["tw-menu__item", danger ? "tw-menu__item--danger" : ""]
		.filter(Boolean)
		.join(" ");

	return (
		<button
			type="button"
			role="menuitem"
			className={classes}
			onClick={(e) => {
				onClick?.(e);
				close();
			}}
		>
			<style jsx>{overlayStyles}</style>
			{icon}
			<span>{children}</span>
		</button>
	);
}

export function MenuDivider() {
	return (
		<div className="tw-menu__divider" role="separator">
			<style jsx>{overlayStyles}</style>
		</div>
	);
}
