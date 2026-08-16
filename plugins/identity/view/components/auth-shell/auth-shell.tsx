import type { ReactNode } from "react";
import { authShellStyles } from "./auth-shell.style";

/**
 * DIRECTION CONTRACT — identity auth world (extension of Cyclorama Dawn).
 * THESIS: auth is a dawn-lit stage — one floating sheet split into a working
 * half (the form) and a light half (the brand); refuses the category's small
 * gray card on a gradient blob.
 * OWN-WORLD: white sheet with hairline --line border on the --bg ground;
 * cobalt --action as the single lit control; the brand half is a quiet band
 * carrying the horizon motif in --wash (cobalt→rose→dawn) — light, never
 * glow or shadow. Outfit headlines, IBM Plex cues.
 * STORY: a non-technical visitor understands in seconds — this is twodb,
 * their second brain: capture, connect, automate, chat, build — and the
 * form is the obvious next step.
 * FIRST VIEWPORT: centered sheet; left panel wordmark → headline → form →
 * footer toggle; right panel horizon motif → positioning line → five true
 * capabilities racked on hairlines. Brand half folds away under 880px.
 * FORM: split-sheet auth (UpGuard reference adapted into twodb's token
 * world). FINISH: unreviewed and undocumented is unfinished; this build
 * ends with the finish review, the verdict, and DESIGN.md.
 */

const CAPABILITIES: { term: string; line: string }[] = [
	{ term: "Capture", line: "Notes and docs the moment you think of them." },
	{ term: "Connect", line: "Everything links, so nothing gets lost." },
	{ term: "Automate", line: "Routine work runs itself." },
	{ term: "Chat", line: "Ask your own data anything." },
	{ term: "Build", line: "Small apps, made for you on request." },
];

/** Half-disc sun rising over a hairline horizon — the Cyclorama Dawn mark. */
function HorizonMark({ size = 22 }: { size?: number }) {
	return (
		<svg
			width={size}
			height={size}
			viewBox="0 0 24 24"
			fill="none"
			aria-hidden="true"
		>
			<defs>
				<linearGradient id="twdb-mark-wash" x1="0" y1="1" x2="1" y2="0">
					<stop offset="0" className="wash-a" />
					<stop offset="0.55" className="wash-b" />
					<stop offset="1" className="wash-c" />
				</linearGradient>
			</defs>
			<path
				d="M6 15a6 6 0 0 1 12 0"
				stroke="url(#twdb-mark-wash)"
				strokeWidth="1.6"
				strokeLinecap="round"
			/>
			<line
				x1="3"
				y1="15"
				x2="21"
				y2="15"
				stroke="currentColor"
				strokeWidth="1.4"
				strokeLinecap="round"
			/>
			<line
				x1="7"
				y1="19"
				x2="17"
				y2="19"
				stroke="currentColor"
				strokeWidth="1.4"
				strokeLinecap="round"
				opacity="0.45"
			/>
		</svg>
	);
}

/** The brand-half hero: light rising over a ruled horizon. */
function HorizonScene() {
	return (
		<svg
			className="auth__horizon"
			viewBox="0 0 520 180"
			fill="none"
			aria-hidden="true"
		>
			<defs>
				<linearGradient id="twdb-scene-wash" x1="0" y1="1" x2="1" y2="0">
					<stop offset="0" className="wash-a" />
					<stop offset="0.55" className="wash-b" />
					<stop offset="1" className="wash-c" />
				</linearGradient>
			</defs>
			<path
				d="M160 140a100 100 0 0 1 200 0"
				stroke="url(#twdb-scene-wash)"
				strokeWidth="2"
				strokeLinecap="round"
			/>
			<path
				d="M188 140a72 72 0 0 1 144 0"
				stroke="url(#twdb-scene-wash)"
				strokeWidth="1.4"
				strokeLinecap="round"
				opacity="0.65"
			/>
			<path
				d="M216 140a44 44 0 0 1 88 0"
				stroke="url(#twdb-scene-wash)"
				strokeWidth="1.2"
				strokeLinecap="round"
				opacity="0.4"
			/>
			<line
				x1="24"
				y1="140"
				x2="496"
				y2="140"
				stroke="currentColor"
				strokeWidth="1"
				opacity="0.35"
			/>
			<line
				x1="80"
				y1="158"
				x2="440"
				y2="158"
				stroke="currentColor"
				strokeWidth="1"
				opacity="0.18"
			/>
		</svg>
	);
}

export function AuthShell({
	title,
	lede,
	children,
}: {
	title: string;
	lede: string;
	children: ReactNode;
}) {
	return (
		<main className="auth">
			<style jsx>{authShellStyles}</style>
			<div className="auth__sheet">
				<section className="auth__panel">
					<span className="auth__wordmark">
						<HorizonMark />
						twodb
					</span>
					<div className="auth__body">
						<header>
							<h1>{title}</h1>
							<p className="lede">{lede}</p>
						</header>
						{children}
					</div>
				</section>
				<aside className="auth__brand">
					<HorizonScene />
					<div className="auth__brand-copy">
						<h2>Your second brain, in one calm place.</h2>
						<p>
							Capture what you know, find it in seconds, and let twodb handle
							the routine work — no technical skills needed.
						</p>
					</div>
					<ul className="auth__capabilities">
						{CAPABILITIES.map((c) => (
							<li key={c.term}>
								<strong>{c.term}</strong>
								<span>{c.line}</span>
							</li>
						))}
					</ul>
				</aside>
			</div>
		</main>
	);
}
