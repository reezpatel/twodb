import {
	useEffect,
	useId,
	useLayoutEffect,
	useRef,
	useState,
	type CSSProperties,
	type KeyboardEvent,
} from "react";
import { createPortal } from "react-dom";
import { Check, Loader2 } from "lucide-react";
import { fieldStyles } from "./field.style";
import { typeaheadStyles } from "./typeahead.style";

export interface TypeaheadItem {
	id: string;
	label: string;
	description?: string;
}

export interface TypeaheadProps {
	items: TypeaheadItem[];
	query: string;
	onQueryChange: (query: string) => void;
	selected: TypeaheadItem | null;
	onSelect: (item: TypeaheadItem | null) => void;
	loading?: boolean;
	placeholder?: string;
	emptyMessage?: string;
	label?: string;
	hint?: string;
	error?: string;
	disabled?: boolean;
	id?: string;
	"aria-label"?: string;
}

/**
 * Presentational combobox: fully controlled (items, query, selection and
 * loading arrive as props); owns only popup/keyboard presentation. Fetching,
 * filtering and debouncing live in the consumer.
 */
export function Typeahead({
	items,
	query,
	onQueryChange,
	selected,
	onSelect,
	loading = false,
	placeholder = "Type to search…",
	emptyMessage = "No results",
	label,
	hint,
	error,
	disabled,
	id,
	"aria-label": ariaLabel,
}: TypeaheadProps) {
	const autoId = useId();
	const baseId = id ?? autoId;
	const labelId = `${baseId}-label`;
	const listId = `${baseId}-listbox`;

	const [open, setOpen] = useState(false);
	const [active, setActive] = useState(-1);
	const [popupStyle, setPopupStyle] = useState<CSSProperties | null>(null);
	const rootRef = useRef<HTMLDivElement>(null);
	const popupRef = useRef<HTMLDivElement>(null);

	const showEmpty = !loading && query.trim().length > 0 && items.length === 0;
	const popupOpen =
		open && !disabled && (loading || items.length > 0 || showEmpty);

	function openList() {
		setActive(items.findIndex((item) => item.id === selected?.id));
		setOpen(true);
	}

	function commit(item: TypeaheadItem) {
		onSelect(item);
		setOpen(false);
	}

	function updatePosition() {
		const root = rootRef.current;
		if (!root) return;
		const rect = root.getBoundingClientRect();
		// A fixed-position element anchored under a top-layer <dialog> uses the
		// dialog as its containing block, so popup coords must be dialog-relative.
		const anchor = root.closest("dialog")?.getBoundingClientRect();
		const offsetX = anchor?.left ?? 0;
		const offsetY = anchor?.top ?? 0;
		const height = Math.min(240, Math.max(items.length, 1) * 36 + 12);
		const flip =
			rect.bottom + 6 + height > window.innerHeight && rect.top > height + 6;
		setPopupStyle({
			position: "fixed",
			left: rect.left - offsetX,
			width: rect.width,
			top: (flip ? rect.top - height - 6 : rect.bottom + 6) - offsetY,
		});
	}

	useLayoutEffect(() => {
		if (popupOpen) updatePosition();
	}, [popupOpen, items, loading, query]);

	useEffect(() => {
		if (!popupOpen) return;
		const onReposition = () => updatePosition();
		window.addEventListener("resize", onReposition);
		document.addEventListener("scroll", onReposition, true);
		return () => {
			window.removeEventListener("resize", onReposition);
			document.removeEventListener("scroll", onReposition, true);
		};
	}, [popupOpen, items, loading]);

	useEffect(() => {
		if (!open) return;
		const onPointerDown = (e: globalThis.MouseEvent) => {
			const target = e.target as Node;
			if (rootRef.current?.contains(target)) return;
			if (popupRef.current?.contains(target)) return;
			setOpen(false);
		};
		document.addEventListener("mousedown", onPointerDown);
		return () => document.removeEventListener("mousedown", onPointerDown);
	}, [open]);

	useEffect(() => {
		if (!open || active < 0) return;
		document
			.getElementById(`${baseId}-option-${active}`)
			?.scrollIntoView({ block: "nearest" });
	}, [open, active, baseId]);

	function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
		if (e.key === "ArrowDown") {
			e.preventDefault();
			if (!open) return openList();
			setActive((i) => Math.min(items.length - 1, i + 1));
			return;
		}
		if (!open) {
			if (e.key === "ArrowUp") {
				e.preventDefault();
				openList();
			}
			return;
		}
		switch (e.key) {
			case "ArrowUp":
				e.preventDefault();
				setActive((i) => Math.max(0, i - 1));
				break;
			case "Home":
				e.preventDefault();
				setActive(0);
				break;
			case "End":
				e.preventDefault();
				setActive(items.length - 1);
				break;
			case "Enter":
				e.preventDefault();
				if (items[active]) commit(items[active]);
				break;
			case "Escape":
				e.preventDefault();
				setOpen(false);
				break;
			case "Tab":
				setOpen(false);
				break;
		}
	}

	const portalTarget = rootRef.current?.closest("dialog") ?? document.body;

	const control = (
		<div className="tw-typeahead" ref={rootRef}>
			<style jsx>{typeaheadStyles}</style>
			<div className="tw-typeahead__input">
				<input
					type="text"
					id={baseId}
					className="tw-typeahead__value"
					role="combobox"
					aria-expanded={popupOpen}
					aria-controls={listId}
					aria-activedescendant={
						popupOpen && active >= 0 ? `${baseId}-option-${active}` : undefined
					}
					aria-labelledby={label ? labelId : undefined}
					aria-label={label ? undefined : ariaLabel}
					aria-invalid={error ? true : undefined}
					aria-autocomplete="list"
					autoComplete="off"
					spellCheck={false}
					value={query}
					placeholder={placeholder}
					disabled={disabled}
					onFocus={() => !open && openList()}
					onChange={(e) => {
						setActive(0);
						onQueryChange(e.target.value);
					}}
					onKeyDown={onKeyDown}
				/>
				{loading ? (
					<Loader2 className="tw-typeahead__spinner" aria-hidden="true" />
				) : null}
			</div>
			{popupOpen && popupStyle
				? createPortal(
						<div
							ref={popupRef}
							id={listId}
							role="listbox"
							className="tw-typeahead__popup"
							style={popupStyle}
						>
							{loading ? (
								<div className="tw-typeahead__status" aria-live="polite">
									<Loader2
										className="tw-typeahead__spinner"
										aria-hidden="true"
									/>
									Searching…
								</div>
							) : items.length === 0 ? (
								<div className="tw-typeahead__status">{emptyMessage}</div>
							) : (
								items.map((item, i) => {
									const isSelected = item.id === selected?.id;
									const classes = [
										"tw-typeahead__option",
										isSelected ? "tw-typeahead__option--selected" : "",
										i === active ? "tw-typeahead__option--active" : "",
									]
										.filter(Boolean)
										.join(" ");
									return (
										<div
											key={item.id}
											id={`${baseId}-option-${i}`}
											role="option"
											aria-selected={isSelected}
											className={classes}
											onMouseEnter={() => setActive(i)}
											onClick={() => commit(item)}
										>
											<span className="tw-typeahead__option-text">
												<span className="tw-typeahead__label">
													{item.label}
												</span>
												{item.description ? (
													<span className="tw-typeahead__description">
														{item.description}
													</span>
												) : null}
											</span>
											{isSelected ? <Check aria-hidden="true" /> : null}
										</div>
									);
								})
							)}
						</div>,
						portalTarget,
					)
				: null}
		</div>
	);

	if (!label && !hint && !error) return control;

	return (
		<div className="tw-field">
			<style jsx>{fieldStyles}</style>
			{label ? (
				<span className="tw-field__label" id={labelId}>
					{label}
				</span>
			) : null}
			{control}
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
