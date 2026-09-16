import {
	Children,
	isValidElement,
	useEffect,
	useRef,
	useState,
	type CSSProperties,
	type ReactElement,
	type ReactNode,
} from "react";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { resizableStyles } from "./resizable.style";

/** Panel size spec: px number, "320px", "40%", or "auto" (fills remaining space). */
export type PanelSize = number | string;

export interface ResizablePanelProps {
	/** Default size — px number, "40%", or "auto" (fills remaining space). */
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

/** px/"40%"/number → percent of root (1–100); "auto"/undefined → undefined. */
function toPercent(
	spec: PanelSize | undefined,
	rootPx: number,
): number | undefined {
	if (spec === undefined || spec === "auto") return undefined;
	const px =
		typeof spec === "number"
			? spec
			: spec.trim().endsWith("%")
				? (Number.parseFloat(spec) / 100) * rootPx
				: Number.parseFloat(spec);
	if (!Number.isFinite(px) || rootPx <= 0) return undefined;
	return Math.min(100, Math.max(1, (px / rootPx) * 100));
}

/** Declarative panel spec; consumed by Resizable (renders as a plain div if
    used standalone). */
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
	const horizontal = direction === "horizontal";

	const panels = Children.toArray(children).filter(
		(child): child is ReactElement<ResizablePanelProps> =>
			isValidElement(child) && child.type === ResizablePanel,
	);
	const specs = panels.map((p) => p.props);

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

	const groupClass = ["tw-resizable__group", `tw-resizable--${direction}`].join(
		" ",
	);

	return (
		<div
			ref={rootRef}
			className={["tw-resizable", `tw-resizable--${direction}`, className]
				.filter(Boolean)
				.join(" ")}
			style={style}
		>
			<style jsx>{resizableStyles}</style>
			{rootPx > 0 ? (
				<PanelGroup direction={direction} className={groupClass}>
					{panels.map((panel, index) => {
						const props = specs[index];
						return [
							<Panel
								key={panel.key ?? index}
								className={
									props.className
										? `tw-resizable__panel ${props.className}`
										: "tw-resizable__panel"
								}
								style={props.style}
								defaultSize={toPercent(props.size, rootPx)}
								minSize={toPercent(props.minSize, rootPx) ?? 0}
								maxSize={toPercent(props.maxSize, rootPx)}
							>
								{props.children}
							</Panel>,
							index < panels.length - 1 ? (
								<PanelResizeHandle
									key={`handle-${panel.key ?? index}`}
									className="tw-resizable__handle"
								/>
							) : null,
						];
					})}
				</PanelGroup>
			) : null}
		</div>
	);
}
