import {
	useEffect,
	useId,
	useLayoutEffect,
	useRef,
	useState,
	type KeyboardEvent,
} from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, SlidersHorizontal } from "lucide-react";
import { HexColorPicker, HexColorInput } from "react-colorful";
import { colorPickerStyles } from "./ColorPicker.style";
import { fieldStyles } from "./Field.style";

export interface ColorSwatchOption {
	value: string;
	name?: string;
}

/** Sixteen tones tuned to sit calmly on both day and night phases. */
export const CURATED_COLORS: ColorSwatchOption[] = [
	{ value: "#17171F", name: "Night ink" },
	{ value: "#5C5B6E", name: "Slate" },
	{ value: "#9291A3", name: "Mist" },
	{ value: "#D9D8E4", name: "Dawn grey" },
	{ value: "#0A2BFF", name: "Cobalt" },
	{ value: "#3A55FF", name: "Stage blue" },
	{ value: "#6D80FF", name: "Cobalt soft" },
	{ value: "#7B5CFF", name: "Violet" },
	{ value: "#D24BFF", name: "Rose" },
	{ value: "#FF7BAE", name: "Rose light" },
	{ value: "#FF9EC0", name: "Dawn pink" },
	{ value: "#C2285A", name: "Deep rose" },
	{ value: "#E07A3F", name: "Ember" },
	{ value: "#D9A03F", name: "Amber" },
	{ value: "#0F9D8F", name: "Teal" },
	{ value: "#3F9D5A", name: "Green" },
];

export interface ColorPickerProps {
	/** Controlled hex value, e.g. "#0A2BFF". */
	value?: string;
	defaultValue?: string;
	onValueChange?: (hex: string) => void;
	/** Swatches shown in the grid. Defaults to the 16 curated tones. */
	colors?: ColorSwatchOption[];
	placeholder?: string;
	label?: string;
	hint?: string;
	error?: string;
	name?: string;
	disabled?: boolean;
	id?: string;
	"aria-label"?: string;
}

/** Pick white or dark ink for a check drawn on top of a swatch. */
function checkInk(hex: string): string {
	const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
	if (!m) return "#ffffff";
	const n = parseInt(m[1], 16);
	const lum =
		(0.2126 * ((n >> 16) & 255) +
			0.7152 * ((n >> 8) & 255) +
			0.0722 * (n & 255)) /
		255;
	return lum > 0.62 ? "#17171f" : "#ffffff";
}

export function ColorPicker({
	value,
	defaultValue = "#0A2BFF",
	onValueChange,
	colors = CURATED_COLORS,
	placeholder = "Pick a color…",
	label,
	hint,
	error,
	name,
	disabled,
	id,
	"aria-label": ariaLabel,
}: ColorPickerProps) {
	const autoId = useId();
	const baseId = id ?? autoId;
	const labelId = `${baseId}-label`;

	const [internal, setInternal] = useState(defaultValue);
	const current = value !== undefined ? value : internal;

	const [open, setOpen] = useState(false);
	const [advanced, setAdvanced] = useState(false);
	const triggerRef = useRef<HTMLButtonElement>(null);
	const popRef = useRef<HTMLDivElement>(null);

	function commit(next: string) {
		if (value === undefined) setInternal(next);
		onValueChange?.(next);
	}

	function openPop() {
		if (disabled) return;
		setOpen(true);
	}

	useLayoutEffect(() => {
		if (!open || !triggerRef.current || !popRef.current) return;
		const r = triggerRef.current.getBoundingClientRect();
		const pop = popRef.current;
		const measured = pop.getBoundingClientRect();
		const flip =
			r.bottom + 6 + measured.height > window.innerHeight &&
			r.top > measured.height;
		pop.style.top = flip
			? `${r.top - measured.height - 6}px`
			: `${r.bottom + 6}px`;
		pop.style.left = `${Math.max(8, Math.min(r.left, window.innerWidth - measured.width - 8))}px`;
	}, [open, advanced]);

	useEffect(() => {
		if (!open) return;
		const onDown = (e: globalThis.MouseEvent) => {
			const t = e.target as Node;
			if (!popRef.current?.contains(t) && !triggerRef.current?.contains(t)) {
				setOpen(false);
			}
		};
		const onKey = (e: globalThis.KeyboardEvent) => {
			if (e.key === "Escape") setOpen(false);
		};
		document.addEventListener("mousedown", onDown);
		document.addEventListener("keydown", onKey);
		return () => {
			document.removeEventListener("mousedown", onDown);
			document.removeEventListener("keydown", onKey);
		};
	}, [open]);

	function onTriggerKey(e: KeyboardEvent<HTMLButtonElement>) {
		if (!open && ["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) {
			e.preventDefault();
			openPop();
		}
	}

	const hasValue = /^#?[0-9a-f]{6}$/i.test(current.trim());
	const norm = current.trim().replace(/^#/, "").toUpperCase();

	const trigger = (
		<div className="tw-colorpick">
			<style jsx>{colorPickerStyles}</style>
			<button
				type="button"
				id={baseId}
				ref={triggerRef}
				className="tw-colorpick__trigger"
				aria-haspopup="dialog"
				aria-expanded={open}
				aria-labelledby={label ? labelId : undefined}
				aria-label={label ? undefined : ariaLabel}
				aria-invalid={error ? true : undefined}
				disabled={disabled}
				onClick={() => (open ? setOpen(false) : openPop())}
				onKeyDown={onTriggerKey}
			>
				<span
					className={
						hasValue
							? "tw-colorpick__chip"
							: "tw-colorpick__chip tw-colorpick__chip--empty"
					}
					style={hasValue ? { background: `#${norm}` } : undefined}
					aria-hidden="true"
				/>
				<span
					className={
						hasValue
							? "tw-colorpick__value"
							: "tw-colorpick__value tw-colorpick__value--placeholder"
					}
				>
					{hasValue ? `#${norm}` : placeholder}
				</span>
				<ChevronDown className="tw-colorpick__chevron" aria-hidden="true" />
			</button>
			{name ? (
				<input type="hidden" name={name} value={hasValue ? `#${norm}` : ""} />
			) : null}
			{open
				? createPortal(
						<div
							className="tw-colorpick__pop"
							ref={popRef}
							role="dialog"
							aria-label="Choose a color"
						>
							<div
								className="tw-colorpick__grid"
								role="group"
								aria-label="Curated colors"
							>
								{colors.map((c) => {
									const selected =
										hasValue &&
										c.value.replace(/^#/, "").toUpperCase() === norm;
									return (
										<button
											key={c.value}
											type="button"
											className={
												selected
													? "tw-colorpick__swatch is-selected"
													: "tw-colorpick__swatch"
											}
											style={{ background: c.value }}
											title={c.name ?? c.value}
											aria-label={c.name ? `${c.name} ${c.value}` : c.value}
											aria-pressed={selected}
											onClick={() => {
												commit(c.value);
												setOpen(false);
											}}
										>
											{selected ? (
												<Check
													aria-hidden="true"
													style={{ color: checkInk(c.value) }}
												/>
											) : null}
										</button>
									);
								})}
							</div>
							{advanced ? (
								<div className="tw-colorpick__advanced">
									<HexColorPicker
										color={hasValue ? `#${norm}` : "#0A2BFF"}
										onChange={(hex) => commit(hex.toUpperCase())}
									/>
									<label className="tw-colorpick__hexfield">
										<span
											className="tw-colorpick__hexprefix"
											aria-hidden="true"
										>
											#
										</span>
										<HexColorInput
											className="tw-colorpick__hex"
											color={hasValue ? norm : ""}
											onChange={(hex) => commit(hex.toUpperCase())}
											prefixed={false}
											aria-label="Hex value"
										/>
									</label>
								</div>
							) : null}
							<button
								type="button"
								className={
									advanced
										? "tw-colorpick__advbtn is-open"
										: "tw-colorpick__advbtn"
								}
								aria-expanded={advanced}
								onClick={() => setAdvanced((a) => !a)}
							>
								<SlidersHorizontal aria-hidden="true" />
								{advanced ? "Hide custom color" : "Custom color"}
							</button>
						</div>,
						document.body,
					)
				: null}
		</div>
	);

	if (!label && !hint && !error) return trigger;

	return (
		<div className="tw-field">
			<style jsx>{fieldStyles}</style>
			{label ? (
				<span className="tw-field__label" id={labelId}>
					{label}
				</span>
			) : null}
			{trigger}
			{error ? (
				<span className="tw-field__error" role="alert">
					{error}
				</span>
			) : hint ? (
				<span className="tw-field__hint">{hint}</span>
			) : null}
		</div>
	);
}
