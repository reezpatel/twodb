import {
	useRef,
	useState,
	type ClipboardEvent,
	type KeyboardEvent,
} from "react";

export interface CodeInputProps {
	/** Number of boxes. */
	length?: number;
	value?: string;
	defaultValue?: string;
	onChange?: (code: string) => void;
	/** Fired once when every box is filled. */
	onComplete?: (code: string) => void;
	/** Error message — paints every box in the danger tone. */
	error?: string;
	autoFocus?: boolean;
	"aria-label"?: string;
}

export function CodeInput({
	length = 6,
	value,
	defaultValue = "",
	onChange,
	onComplete,
	error,
	autoFocus,
	"aria-label": ariaLabel = "Verification code",
}: CodeInputProps) {
	const [internal, setInternal] = useState(defaultValue);
	const code = value !== undefined ? value : internal;
	const refs = useRef<(HTMLInputElement | null)[]>([]);

	function commit(next: string) {
		const clean = next.replace(/\D/g, "").slice(0, length);
		if (value === undefined) setInternal(clean);
		onChange?.(clean);
		if (clean.length === length) onComplete?.(clean);
	}

	function handleChange(i: number, raw: string) {
		const digit = raw.replace(/\D/g, "").slice(-1);
		const next = (code.slice(0, i) + digit + code.slice(i + 1)).slice(
			0,
			length,
		);
		commit(digit ? next : code.slice(0, i) + code.slice(i + 1));
		if (digit && i < length - 1) refs.current[i + 1]?.focus();
	}

	function handleKeyDown(i: number, e: KeyboardEvent<HTMLInputElement>) {
		if (e.key === "Backspace" && !code[i] && i > 0) {
			refs.current[i - 1]?.focus();
			commit(code.slice(0, i - 1) + code.slice(i));
		}
		if (e.key === "ArrowLeft" && i > 0) refs.current[i - 1]?.focus();
		if (e.key === "ArrowRight" && i < length - 1) refs.current[i + 1]?.focus();
	}

	function handlePaste(i: number, e: ClipboardEvent<HTMLInputElement>) {
		e.preventDefault();
		const pasted = e.clipboardData.getData("text").replace(/\D/g, "");
		if (!pasted) return;
		const next = (code.slice(0, i) + pasted).slice(0, length);
		commit(next);
		const focusTo = Math.min(i + pasted.length, length - 1);
		refs.current[focusTo]?.focus();
	}

	return (
		<div
			className={["tw-codeinput", error ? "tw-codeinput--error" : ""]
				.filter(Boolean)
				.join(" ")}
			role="group"
			aria-label={ariaLabel}
		>
			{Array.from({ length }, (_, i) => (
				<input
					key={i}
					ref={(el) => {
						refs.current[i] = el;
					}}
					className="tw-codeinput__box tw-tnum"
					type="text"
					inputMode="numeric"
					autoComplete={i === 0 ? "one-time-code" : "off"}
					maxLength={1}
					aria-label={`Digit ${i + 1} of ${length}`}
					aria-invalid={error ? true : undefined}
					value={code[i] ?? ""}
					autoFocus={autoFocus && i === 0}
					onChange={(e) => handleChange(i, e.target.value)}
					onKeyDown={(e) => handleKeyDown(i, e)}
					onPaste={(e) => handlePaste(i, e)}
				/>
			))}
		</div>
	);
}
