import { WaitlistForm } from "./WaitlistForm";

/** The day ends; tomorrow's brief is already drafting. Night returns. */
export function Close() {
	return (
		<>
			<section
				id="waitlist"
				className="close nightfield"
				data-phase="night"
				data-nav="night"
				aria-labelledby="close-title"
			>
				<div className="wrap close__inner">
					<span className="cue" data-reveal>
						Act 06 — Tomorrow
					</span>
					<h2
						id="close-title"
						data-reveal
						style={{ "--d": "60ms" } as React.CSSProperties}
					>
						The day ends. Tomorrow's brief is already drafting.
					</h2>
					<p data-reveal style={{ "--d": "120ms" } as React.CSSProperties}>
						One calm umbrella for the whole day — inboxes, chats, notes, files,
						calendar, and customer data, with an intelligence that works inside
						your business. And when no tool fits, it builds one.
					</p>
					<div
						className="waitlist"
						data-reveal
						style={{ "--d": "180ms" } as React.CSSProperties}
					>
						<WaitlistForm />
					</div>
				</div>
			</section>
			<footer className="footer nightfield">
				<div className="wrap footer__inner">
					<span className="footer__wordmark">twodb</span>
					<p>
						All product scenes show synthetic data. · Built in the open, one cue
						at a time.
					</p>
				</div>
			</footer>
		</>
	);
}
