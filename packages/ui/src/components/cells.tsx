import { useEffect, useLayoutEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Link2, Paperclip, Star } from "lucide-react";
import { Badge, type BadgeTone } from "./Badge";
import { tableStyles } from "./Table.style";

export type CellType =
	| "text"
	| "number"
	| "currency"
	| "url"
	| "select"
	| "multiselect"
	| "chips"
	| "file"
	| "progress"
	| "stars";

export interface CellOption {
	value: string;
	label: string;
	tone?: BadgeTone;
}

/* ---------------- Display ---------------- */

export function CellView({
	type,
	value,
	options,
}: {
	type: CellType;
	value: unknown;
	options?: CellOption[];
}) {
	switch (type) {
		case "number":
			return <span className="tw-tnum">{String(value ?? "")}</span>;

		case "currency":
			return (
				<span className="tw-tnum">
					₹{Number(value ?? 0).toLocaleString("en-IN")}
				</span>
			);

		case "url":
			return (
				<span className="tw-cell-url">
					<style jsx>{tableStyles}</style>
					<Link2 aria-hidden="true" />
					<span>{String(value ?? "")}</span>
				</span>
			);

		case "file":
			return value ? (
				<span className="tw-cell-file">
					<style jsx>{tableStyles}</style>
					<Paperclip aria-hidden="true" />
					<span>{String(value)}</span>
				</span>
			) : (
				<span className="tw-cell-empty">—</span>
			);

		case "select": {
			const opt = options?.find((o) => o.value === value);
			return value ? (
				<Badge size="sm" tone={opt?.tone ?? "neutral"}>
					{opt?.label ?? String(value)}
				</Badge>
			) : (
				<span className="tw-cell-empty">—</span>
			);
		}

		case "multiselect":
		case "chips": {
			const list = Array.isArray(value) ? (value as string[]) : [];
			if (list.length === 0) return <span className="tw-cell-empty">—</span>;
			return (
				<span className="tw-cell-chips">
					<style jsx>{tableStyles}</style>
					{list.map((v) => {
						const opt = options?.find((o) => o.value === v);
						return (
							<Badge key={v} size="sm" tone={opt?.tone ?? "neutral"}>
								{opt?.label ?? v}
							</Badge>
						);
					})}
				</span>
			);
		}

		case "progress": {
			const pct = Math.max(0, Math.min(100, Number(value ?? 0)));
			return (
				<span className="tw-cell-progress">
					<style jsx>{tableStyles}</style>
					<span className="tw-cell-progress__bar">
						<i style={{ transform: `scaleX(${pct / 100})` }} />
					</span>
					<span className="tw-tnum">{pct}%</span>
				</span>
			);
		}

		case "stars": {
			const n = Number(value ?? 0);
			return (
				<span className="tw-cell-stars" aria-label={`${n} out of 5`}>
					<style jsx>{tableStyles}</style>
					{[1, 2, 3, 4, 5].map((i) => (
						<Star
							key={i}
							aria-hidden="true"
							className={i <= n ? "is-on" : undefined}
						/>
					))}
				</span>
			);
		}

		default:
			return <>{String(value ?? "")}</>;
	}
}

/* ---------------- Editors ---------------- */

interface EditorProps {
	type: CellType;
	value: unknown;
	options?: CellOption[];
	/** Commit a value. Parent closes the editor (except multiselect, which stays open). */
	onCommit: (value: unknown) => void;
	/** Close without committing. */
	onClose: () => void;
}

/** Anchors a fixed-position popup to the editor's cell (escapes overflow clipping). */
function usePopupPos(onClose: () => void) {
	const anchorRef = useRef<HTMLSpanElement>(null);
	const popupRef = useRef<HTMLDivElement>(null);

	useLayoutEffect(() => {
		if (!anchorRef.current || !popupRef.current) return;
		const r = anchorRef.current.getBoundingClientRect();
		const pop = popupRef.current;
		const w = Math.max(180, r.width);
		pop.style.top = `${r.bottom + 4}px`;
		pop.style.left = `${Math.max(8, Math.min(r.left, window.innerWidth - w - 16))}px`;
		pop.style.minWidth = `${w}px`;
		const measured = pop.getBoundingClientRect();
		if (measured.right > window.innerWidth - 8) {
			pop.style.left = `${Math.max(8, window.innerWidth - measured.width - 8)}px`;
		}
	}, []);

	useEffect(() => {
		const onDown = (e: globalThis.MouseEvent) => {
			const t = e.target as Node;
			if (!popupRef.current?.contains(t) && !anchorRef.current?.contains(t))
				onClose();
		};
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Escape") onClose();
		};
		document.addEventListener("mousedown", onDown);
		document.addEventListener("keydown", onKey);
		return () => {
			document.removeEventListener("mousedown", onDown);
			document.removeEventListener("keydown", onKey);
		};
	}, [onClose]);

	return { anchorRef, popupRef };
}

export function CellEditor({
	type,
	value,
	options,
	onCommit,
	onClose,
}: EditorProps) {
	const { anchorRef, popupRef } = usePopupPos(onClose);

	/* text-like editors: uncontrolled, commit on Enter/blur — zero re-renders while typing */
	if (
		type === "text" ||
		type === "url" ||
		type === "number" ||
		type === "currency" ||
		type === "file"
	) {
		return (
			<>
				<input
					className="tw-cell-input"
					type={type === "number" || type === "currency" ? "number" : "text"}
					defaultValue={String(value ?? "")}
					placeholder={
						type === "file"
							? "File name…"
							: type === "url"
								? "https://…"
								: undefined
					}
					autoFocus
					onFocus={(e) => {
						const len = e.target.value.length;
						e.target.setSelectionRange(len, len);
					}}
					onKeyDown={(e) => {
						if (e.key === "Enter")
							onCommit((e.target as HTMLInputElement).value);
						if (e.key === "Escape") onClose();
					}}
					onBlur={(e) => onCommit(e.target.value)}
				/>
				<style jsx>{tableStyles}</style>
			</>
		);
	}

	if (type === "stars") {
		const n = Number(value ?? 0);
		return (
			<span className="tw-cell-stars tw-cell-stars--edit" ref={anchorRef}>
				<style jsx>{tableStyles}</style>
				{[1, 2, 3, 4, 5].map((i) => (
					<button
						key={i}
						type="button"
						aria-label={`${i} star${i > 1 ? "s" : ""}`}
						onClick={() => onCommit(i)}
					>
						<Star aria-hidden="true" className={i <= n ? "is-on" : undefined} />
					</button>
				))}
			</span>
		);
	}

	if (type === "progress") {
		return (
			<>
				<input
					className="tw-cell-range"
					type="range"
					min={0}
					max={100}
					step={5}
					defaultValue={Number(value ?? 0)}
					autoFocus
					aria-label="Progress"
					onChange={(e) => onCommit(Number(e.target.value))}
					onKeyDown={(e) => {
						if (e.key === "Enter" || e.key === "Escape") onClose();
					}}
					onPointerUp={onClose}
				/>
				<style jsx>{tableStyles}</style>
			</>
		);
	}

	if (type === "select") {
		return (
			<span ref={anchorRef}>
				<style jsx>{tableStyles}</style>
				<span className="tw-cell-popanchor">{String(value ?? "")}</span>
				{createPortal(
					<div className="tw-cellpop" ref={popupRef} role="listbox">
						{(options ?? []).map((opt) => (
							<button
								key={opt.value}
								type="button"
								role="option"
								aria-selected={opt.value === value}
								className={
									opt.value === value
										? "tw-cellpop__item tw-cellpop__item--selected"
										: "tw-cellpop__item"
								}
								onClick={() => onCommit(opt.value)}
							>
								<Badge size="sm" tone={opt.tone ?? "neutral"}>
									{opt.label}
								</Badge>
							</button>
						))}
					</div>,
					document.body,
				)}
			</span>
		);
	}

	/* multiselect / chips: commit on every toggle, close on outside/Escape */
	const selected = Array.isArray(value) ? (value as string[]) : [];
	return (
		<span ref={anchorRef}>
			<style jsx>{tableStyles}</style>
			<span className="tw-cell-popanchor">
				<CellView type="chips" value={selected} options={options} />
			</span>
			{createPortal(
				<div
					className="tw-cellpop"
					ref={popupRef}
					role="listbox"
					aria-multiselectable="true"
				>
					{(options ?? []).map((opt) => {
						const on = selected.includes(opt.value);
						return (
							<button
								key={opt.value}
								type="button"
								role="option"
								aria-selected={on}
								className={
									on
										? "tw-cellpop__item tw-cellpop__item--selected"
										: "tw-cellpop__item"
								}
								onClick={() =>
									onCommit(
										on
											? selected.filter((v) => v !== opt.value)
											: [...selected, opt.value],
									)
								}
							>
								<Badge size="sm" tone={opt.tone ?? "neutral"}>
									{opt.label}
								</Badge>
							</button>
						);
					})}
					<div className="tw-cellpop__foot">
						<button
							type="button"
							className="tw-cellpop__done"
							onClick={onClose}
						>
							Done
						</button>
					</div>
				</div>,
				document.body,
			)}
		</span>
	);
}
