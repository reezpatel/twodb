import {
	Children,
	isValidElement,
	useEffect,
	useRef,
	useState,
	type CSSProperties,
	type KeyboardEvent,
	type PointerEvent as ReactPointerEvent,
	type ReactElement,
	type ReactNode,
} from "react";
import { resizableStyles } from "./resizable.style";

/** Panel size spec: px number, "320px", "40%", or "auto" (fills remaining space). */
export type PanelSize = number | string;

export interface ResizablePanelProps {
	/** Default size — px number, "320px", "40%", or "auto" (flexes to fill). */
	size?: PanelSize;
	/** Smallest size while dragging — px or "%". */
	minSize?: PanelSize;
	/** Largest size while dragging — px or "%". */
	maxSize?: PanelSize;
	className?: string;
	style?: CSSProperties;
	children?: ReactNode;
}

export interface ResizableProps {
	/** horizontal = side-by-side panels, vertical = stacked. */
	direction?: "horizontal" | "vertical";
	className?: string;
	style?: CSSProperties;
	children?: ReactNode;
}

const KEY_STEP = 16;

/** "320px"/"40%"/number → px against the root; "auto"/undefined → null. */
function parseSize(spec: PanelSize | undefined, rootPx: number): number | null {
	if (spec === undefined || spec === "auto") return null;
	if (typeof spec === "number") return spec;
	if (spec.trim().endsWith("%")) {
		return (Number.parseFloat(spec) / 100) * rootPx;
	}
	const px = Number.parseFloat(spec);
	return Number.isFinite(px) ? px : null;
}

function cssSize(spec: PanelSize | undefined): string {
	if (spec === undefined) return "auto";
	return typeof spec === "number" ? `${spec}px` : spec;
}

export function ResizablePanel({
	className,
	style,
	children,
}: ResizablePanelProps) {
	return (
		<div
			className={["tw-resizable__panel", className].filter(Boolean).join(" ")}
			style={style}
		>
			{/* same styles object → same scoped hash as in Resizable; the
			    registry dedupes the injected tag */}
			<style jsx>{resizableStyles}</style>
			{children}
		</div>
	);
}

export function Resizable({
	direction = "horizontal",
	className,
	style,
	children,
}: ResizableProps) {
	const rootRef = useRef<HTMLDivElement>(null);
	const [rootPx, setRootPx] = useState(0);
	/** Manual drag results per panel index (px). Absent = resolve from spec. */
	const [overrides, setOverrides] = useState<Record<number, number>>({});

	const panels = Children.toArray(children).filter(
		(child): child is ReactElement<ResizablePanelProps> =>
			isValidElement(child) && child.type === ResizablePanel,
	);
	const specs = panels.map((p) => p.props);
	const horizontal = direction === "horizontal";

	useEffect(() => {
		const el = rootRef.current;
		if (!el) return;
		const measure = () =>
			setRootPx(horizontal ? el.clientWidth : el.clientHeight);
		measure();
		const ro = new ResizeObserver(measure);
		ro.observe(el);
		return () => ro.disconnect();
	}, [horizontal]);

	const isAuto = (i: number) => parseSize(specs[i]?.size, rootPx) === null;
	const pxOf = (i: number) => overrides[i] ?? parseSize(specs[i]?.size, rootPx);

	const applyDelta = (i: number, startPx: number, delta: number) => {
		const min = parseSize(specs[i].minSize, rootPx) ?? 0;
		const max = parseSize(specs[i].maxSize, rootPx) ?? Number.POSITIVE_INFINITY;
		const next = Math.min(max, Math.max(min, startPx + delta));
		setOverrides((prev) => ({ ...prev, [i]: next }));
	};

	/** The handle before panel `afterIndex` resizes the nearest sized neighbor. */
	const targetFor = (
		afterIndex: number,
	): { i: number; sign: 1 | -1 } | null => {
		if (!isAuto(afterIndex - 1)) return { i: afterIndex - 1, sign: 1 };
		if (!isAuto(afterIndex)) return { i: afterIndex, sign: -1 };
		return null;
	};

	const startDrag = (afterIndex: number) => (e: ReactPointerEvent) => {
		const target = targetFor(afterIndex);
		if (!target) return;
		e.preventDefault();
		const startPos = horizontal ? e.clientX : e.clientY;
		const startPx = pxOf(target.i) ?? 0;

		const onMove = (ev: PointerEvent) => {
			const pos = horizontal ? ev.clientX : ev.clientY;
			applyDelta(target.i, startPx, target.sign * (pos - startPos));
		};
		const onUp = () => {
			window.removeEventListener("pointermove", onMove);
			window.removeEventListener("pointerup", onUp);
		};
		window.addEventListener("pointermove", onMove);
		window.addEventListener("pointerup", onUp);
	};

	const onHandleKeyDown =
		(afterIndex: number) => (e: KeyboardEvent<HTMLDivElement>) => {
			const target = targetFor(afterIndex);
			if (!target) return;
			const forward = horizontal ? "ArrowRight" : "ArrowDown";
			const backward = horizontal ? "ArrowLeft" : "ArrowUp";
			if (e.key !== forward && e.key !== backward) return;
			e.preventDefault();
			const delta = (e.key === forward ? KEY_STEP : -KEY_STEP) * target.sign;
			applyDelta(target.i, pxOf(target.i) ?? 0, delta);
		};

	return (
		<div
			ref={rootRef}
			className={["tw-resizable", `tw-resizable--${direction}`, className]
				.filter(Boolean)
				.join(" ")}
			style={style}
		>
			<style jsx>{resizableStyles}</style>
			{panels.map((panel, index) => {
				const auto = isAuto(index);
				const px = pxOf(index);
				const panelStyle: CSSProperties = auto
					? { flex: "1 1 0%", minWidth: 0, minHeight: 0 }
					: {
							flex: `0 0 ${overrides[index] !== undefined ? `${px}px` : cssSize(specs[index].size)}`,
							minWidth: 0,
							minHeight: 0,
						};
				return [
					<ResizablePanel
						key={panel.key ?? index}
						{...panel.props}
						style={{ ...panelStyle, ...panel.props.style }}
					/>,
					index < panels.length - 1 ? (
						<div
							key={`handle-${panel.key ?? index}`}
							className="tw-resizable__handle"
							role="separator"
							tabIndex={0}
							aria-orientation={horizontal ? "vertical" : "horizontal"}
							onPointerDown={startDrag(index + 1)}
							onKeyDown={onHandleKeyDown(index + 1)}
						/>
					) : null,
				];
			})}
		</div>
	);
}
