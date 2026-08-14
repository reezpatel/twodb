import { WaitlistForm } from "./WaitlistForm";
import { BriefScene } from "./scenes/BriefScene";

/** Act 01 — 6:30 AM. The night stage where the brief drafts itself. */
export function Hero() {
	return (
		<section
			id="hero"
			className="hero nightfield"
			data-phase="night"
			data-nav="night"
			aria-labelledby="hero-title"
		>
			<div className="wrap">
				<div className="hero__grid">
					<div>
						<span className="cue hero__cue tnum">Act 01 — 6:30 AM</span>
						<h1 id="hero-title">Your day is already planned.</h1>
						<p className="hero__lede">
							twodb is the everything app for small business. While you slept,
							it read your inboxes, your calendar, and your stock book — and
							drafted the morning brief. Deliveries prepped. Six unpaid accounts
							turned into reminders. The one thing that matters, on top.
						</p>
						<div className="hero__actions">
							<WaitlistForm />
						</div>
						<div style={{ marginTop: 16 }}>
							<a className="hero__ghost" href="#beat-morning">
								See how it works
								<svg
									width="13"
									height="13"
									viewBox="0 0 16 16"
									fill="none"
									aria-hidden="true"
									style={{ marginLeft: 8 }}
								>
									<path
										d="M8 2.5v10m0 0 4-4m-4 4-4-4"
										stroke="currentColor"
										strokeWidth="1.6"
										strokeLinecap="round"
										strokeLinejoin="round"
									/>
								</svg>
							</a>
						</div>
					</div>
					<div>
						<BriefScene />
						<p className="cue" style={{ marginTop: 12, textAlign: "right" }}>
							Product scene · synthetic data
						</p>
					</div>
				</div>
				<div
					className="vignette"
					data-reveal
					style={{ marginTop: 72, maxWidth: 720 }}
				>
					<span className="vignette__who">For the shop owner</span>
					<p className="vignette__line">
						You run the store. Before the shutters go up, the day is already on
						one page — deliveries prepped, stock flagged, and the reminders you
						didn't have to write.
					</p>
				</div>
			</div>
		</section>
	);
}
