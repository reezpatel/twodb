import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Calendar as CalendarIcon, Clock } from "lucide-react";
import type { DateRange } from "react-day-picker";
import { Calendar } from "./Calendar";
import { Button } from "./Button";
import { Select } from "./Select";
import { calendarStyles } from "./Calendar.style";
import { fieldStyles } from "./Field.style";

const DATE_FMT = new Intl.DateTimeFormat("en-IN", {
	day: "numeric",
	month: "short",
	year: "numeric",
});
const TIME_FMT = new Intl.DateTimeFormat("en-IN", {
	hour: "numeric",
	minute: "2-digit",
	hour12: true,
});

const HOURS = Array.from({ length: 12 }, (_, i) => ({
	value: String(i + 1),
	label: String(i + 1),
}));
const MINUTES = Array.from({ length: 12 }, (_, i) => ({
	value: String(i * 5),
	label: String(i * 5).padStart(2, "0"),
}));
const PERIODS = [
	{ value: "AM", label: "AM" },
	{ value: "PM", label: "PM" },
];

/* --- shared field + popup shell --- */

interface FieldShellProps {
	label?: string;
	hint?: string;
	error?: string;
	icon?: ReactNode;
	display?: string;
	placeholder: string;
	open: boolean;
	onToggle: () => void;
	onClose: () => void;
	children: ReactNode;
}

function FieldShell({
	label,
	hint,
	error,
	icon,
	display,
	placeholder,
	open,
	onToggle,
	onClose,
	children,
}: FieldShellProps) {
	const autoId = useId();
	const labelId = `${autoId}-label`;
	const anchorRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (!open) return;
		const onDown = (e: globalThis.MouseEvent) => {
			if (!anchorRef.current?.contains(e.target as Node)) onClose();
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
	}, [open, onClose]);

	const field = (
		<div className="tw-picker" ref={anchorRef}>
			<style jsx>{calendarStyles}</style>
			<button
				type="button"
				className="tw-picker__trigger"
				aria-haspopup="dialog"
				aria-expanded={open}
				aria-labelledby={label ? labelId : undefined}
				aria-label={label ? undefined : placeholder}
				aria-invalid={error ? true : undefined}
				onClick={onToggle}
			>
				{icon ?? <CalendarIcon aria-hidden="true" />}
				<span
					className={display ? "tw-picker__value" : "tw-picker__placeholder"}
				>
					{display || placeholder}
				</span>
			</button>
			{open ? <div className="tw-picker__popup">{children}</div> : null}
		</div>
	);

	if (!label && !hint && !error) return field;

	return (
		<div className="tw-field">
			<style jsx>{fieldStyles}</style>
			{label ? (
				<span className="tw-field__label" id={labelId}>
					{label}
				</span>
			) : null}
			{field}
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

/* --- time fields (shared by TimePicker + DateTimePicker) --- */

function TimeFields({
	value,
	onChange,
}: {
	value: Date;
	onChange: (d: Date) => void;
}) {
	const h24 = value.getHours();
	const hour12 = h24 % 12 === 0 ? 12 : h24 % 12;
	const period = h24 < 12 ? "AM" : "PM";
	const minute = (Math.round(value.getMinutes() / 5) * 5) % 60;

	function apply(h12: number, min: number, p: string) {
		let h = h12 % 12;
		if (p === "PM") h += 12;
		const next = new Date(value);
		next.setHours(h, min, 0, 0);
		onChange(next);
	}

	return (
		<>
			<Select
				label="Hour"
				aria-label="Hour"
				value={String(hour12)}
				onValueChange={(v) => apply(Number(v), minute, period)}
				options={HOURS}
			/>
			<Select
				label="Minute"
				aria-label="Minute"
				value={String(minute)}
				onValueChange={(v) => apply(hour12, Number(v), period)}
				options={MINUTES}
			/>
			<Select
				label="AM / PM"
				aria-label="AM or PM"
				value={period}
				onValueChange={(v) => apply(hour12, minute, v)}
				options={PERIODS}
			/>
		</>
	);
}

/* --- DatePicker --- */

export interface DatePickerProps {
	value?: Date;
	defaultValue?: Date;
	onValueChange?: (date: Date | undefined) => void;
	placeholder?: string;
	label?: string;
	hint?: string;
	error?: string;
	disabled?: boolean;
}

export function DatePicker({
	value,
	defaultValue,
	onValueChange,
	placeholder = "Pick a date…",
	label,
	hint,
	error,
	disabled,
}: DatePickerProps) {
	const [internal, setInternal] = useState<Date | undefined>(defaultValue);
	const current = value !== undefined ? value : internal;
	const [open, setOpen] = useState(false);

	return (
		<FieldShell
			label={label}
			hint={hint}
			error={error}
			display={current ? DATE_FMT.format(current) : undefined}
			placeholder={placeholder}
			open={open}
			onToggle={() => !disabled && setOpen((o) => !o)}
			onClose={() => setOpen(false)}
		>
			<Calendar
				mode="single"
				selected={current}
				onSelect={(d) => {
					if (value === undefined) setInternal(d);
					onValueChange?.(d);
					if (d) setOpen(false);
				}}
				defaultMonth={current}
			/>
		</FieldShell>
	);
}

/* --- DateRangePicker (two months) --- */

export interface DateRangePickerProps {
	value?: DateRange;
	defaultValue?: DateRange;
	onValueChange?: (range: DateRange | undefined) => void;
	placeholder?: string;
	label?: string;
	hint?: string;
	error?: string;
	disabled?: boolean;
}

export function DateRangePicker({
	value,
	defaultValue,
	onValueChange,
	placeholder = "Pick a range…",
	label,
	hint,
	error,
	disabled,
}: DateRangePickerProps) {
	const [internal, setInternal] = useState<DateRange | undefined>(defaultValue);
	const current = value !== undefined ? value : internal;
	const [open, setOpen] = useState(false);

	const display =
		current?.from && current.to
			? `${DATE_FMT.format(current.from)} – ${DATE_FMT.format(current.to)}`
			: current?.from
				? `${DATE_FMT.format(current.from)} – …`
				: undefined;

	return (
		<FieldShell
			label={label}
			hint={hint}
			error={error}
			display={display}
			placeholder={placeholder}
			open={open}
			onToggle={() => !disabled && setOpen((o) => !o)}
			onClose={() => setOpen(false)}
		>
			<Calendar
				mode="range"
				numberOfMonths={2}
				selected={current}
				defaultMonth={current?.from}
				onSelect={(range) => {
					if (value === undefined) setInternal(range);
					onValueChange?.(range);
					/* v9 sets from=to on the first click; close once a real span exists */
					if (
						range?.from &&
						range?.to &&
						range.from.getTime() !== range.to.getTime()
					) {
						setOpen(false);
					}
				}}
			/>
		</FieldShell>
	);
}

/* --- DateTimePicker --- */

export interface DateTimePickerProps {
	value?: Date;
	defaultValue?: Date;
	onValueChange?: (date: Date | undefined) => void;
	placeholder?: string;
	label?: string;
	hint?: string;
	error?: string;
	disabled?: boolean;
}

export function DateTimePicker({
	value,
	defaultValue,
	onValueChange,
	placeholder = "Pick date & time…",
	label,
	hint,
	error,
	disabled,
}: DateTimePickerProps) {
	const [internal, setInternal] = useState<Date | undefined>(defaultValue);
	const current = value !== undefined ? value : internal;
	const [open, setOpen] = useState(false);

	function commit(d: Date | undefined) {
		if (value === undefined) setInternal(d);
		onValueChange?.(d);
	}

	return (
		<FieldShell
			label={label}
			hint={hint}
			error={error}
			display={
				current
					? `${DATE_FMT.format(current)}, ${TIME_FMT.format(current)}`
					: undefined
			}
			placeholder={placeholder}
			open={open}
			onToggle={() => !disabled && setOpen((o) => !o)}
			onClose={() => setOpen(false)}
		>
			<Calendar
				mode="single"
				selected={current}
				onSelect={(d) => {
					if (!d) return commit(d);
					/* keep the chosen time when the day changes */
					const next = new Date(d);
					if (current)
						next.setHours(current.getHours(), current.getMinutes(), 0, 0);
					else next.setHours(9, 0, 0, 0);
					commit(next);
				}}
				defaultMonth={current}
			/>
			<div className="tw-picker__time">
				<TimeFields
					value={current ?? new Date(new Date().setHours(9, 0, 0, 0))}
					onChange={commit}
				/>
				<Button
					size="sm"
					variant="ghost"
					className="tw-picker__done"
					onClick={() => setOpen(false)}
				>
					Done
				</Button>
			</div>
		</FieldShell>
	);
}

/* --- TimePicker --- */

export interface TimePickerProps {
	value?: Date;
	defaultValue?: Date;
	onValueChange?: (date: Date | undefined) => void;
	placeholder?: string;
	label?: string;
	hint?: string;
	error?: string;
	disabled?: boolean;
}

export function TimePicker({
	value,
	defaultValue,
	onValueChange,
	placeholder = "Pick a time…",
	label,
	hint,
	error,
	disabled,
}: TimePickerProps) {
	const [internal, setInternal] = useState<Date | undefined>(defaultValue);
	const current = value !== undefined ? value : internal;
	const [open, setOpen] = useState(false);

	return (
		<FieldShell
			label={label}
			hint={hint}
			error={error}
			icon={<Clock aria-hidden="true" />}
			display={current ? TIME_FMT.format(current) : undefined}
			placeholder={placeholder}
			open={open}
			onToggle={() => !disabled && setOpen((o) => !o)}
			onClose={() => setOpen(false)}
		>
			<div
				style={{
					display: "flex",
					gap: "var(--space-2)",
					alignItems: "flex-end",
				}}
			>
				<TimeFields
					value={current ?? new Date(new Date().setHours(9, 0, 0, 0))}
					onChange={(d) => {
						if (value === undefined) setInternal(d);
						onValueChange?.(d);
					}}
				/>
				<Button
					size="sm"
					variant="ghost"
					className="tw-picker__done"
					onClick={() => setOpen(false)}
				>
					Done
				</Button>
			</div>
		</FieldShell>
	);
}
