import { useState, type FormEvent } from "react";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const STORE_KEY = "twodb.waitlist";

function CheckIcon() {
	return (
		<svg
			width="16"
			height="16"
			viewBox="0 0 16 16"
			fill="none"
			aria-hidden="true"
		>
			<path
				d="M3 8.5 6.5 12 13 4.5"
				stroke="currentColor"
				strokeWidth="1.8"
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
		</svg>
	);
}

/** The single action, everywhere: email in, quiet confirmation out. */
export function WaitlistForm() {
	const [email, setEmail] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [done, setDone] = useState(
		() =>
			typeof window !== "undefined" &&
			window.localStorage.getItem(STORE_KEY) === "1",
	);

	function onSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const value = email.trim();
		if (!EMAIL_RE.test(value)) {
			setError("That email doesn't look complete — check it and try again.");
			return;
		}
		window.localStorage.setItem(STORE_KEY, "1");
		setError(null);
		setDone(true);
	}

	if (done) {
		return (
			<div className="waitlist__done" role="status">
				<span className="waitlist__check">
					<CheckIcon />
				</span>
				<p>You're on the list. We'll write when it's your turn.</p>
			</div>
		);
	}

	return (
		<form className="waitlist" onSubmit={onSubmit} noValidate>
			<div className="waitlist__row">
				<input
					className="waitlist__input"
					type="email"
					name="email"
					autoComplete="email"
					placeholder="you@yourbusiness.com"
					aria-label="Email address"
					aria-invalid={error ? true : undefined}
					value={email}
					onChange={(event) => {
						setEmail(event.target.value);
						if (error) setError(null);
					}}
				/>
				<button className="waitlist__btn" type="submit">
					Join the waitlist
				</button>
			</div>
			{error ? (
				<p className="waitlist__error" role="alert">
					{error}
				</p>
			) : null}
		</form>
	);
}
