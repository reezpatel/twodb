import { WaitlistForm } from "./waitlist-form";

/** The mid-page ask, after beat 3. */
export function CtaBand() {
	return (
		<div className="ctaband" data-reveal>
			<div>
				<h3>Your business, running itself by lunch.</h3>
				<p>
					Early access opens in small batches. Leave your email and we'll write
					when it's your turn.
				</p>
			</div>
			<WaitlistForm />
		</div>
	);
}
