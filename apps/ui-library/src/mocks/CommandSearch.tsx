/* Command Search mock — a cmd+K palette empty state inspired by the
   supplied reference: a borderless search row with a clear action, a
   centered empty state (folder illustration, "No projects found",
   clear/create actions), and a footer of keyboard hints built on the
   Kbd primitive. Cyclorama grammar: hairlines, quiet inks, one lit
   action. */

import { useState } from "react";
import { Button, Kbd } from "@twodb/ui";
import {
	ArrowDown,
	ArrowLeft,
	ArrowUp,
	Command,
	CornerDownLeft,
	Search,
} from "lucide-react";
import "./CommandSearch.css";

/* ---------- illustration ---------- */

/** Empty-folder illustration — a violet folder with a peeking document. */
function FolderIllustration() {
	return (
		<svg
			className="mock-cs__art"
			width="76"
			height="76"
			viewBox="0 0 80 80"
			fill="none"
			aria-hidden="true"
		>
			<defs>
				<linearGradient id="cs-folder" x1="38" y1="30" x2="38" y2="60">
					<stop offset="0" stopColor="#8f80ff" />
					<stop offset="1" stopColor="#6d5cf0" />
				</linearGradient>
			</defs>
			{/* back panel */}
			<path
				d="M14 28c0-2.2 1.8-4 4-4h9c1.1 0 2.1.4 2.8 1.2l3 3.6c.7.8 1.7 1.2 2.8 1.2H58c2.2 0 4 1.8 4 4v20c0 2.2-1.8 4-4 4H18c-2.2 0-4-1.8-4-4V28z"
				fill="#7c6bf3"
			/>
			{/* peeking document */}
			<g transform="rotate(10 48 24)">
				<rect
					x="38"
					y="8"
					width="20"
					height="26"
					rx="3"
					fill="#ffffff"
					stroke="#e3e1ee"
				/>
				<path d="M52 8l6 6h-6V8z" fill="#eceaf6" />
				<path
					d="M43 18h6l-4 6h6"
					stroke="#7c6bf3"
					strokeWidth="1.6"
					strokeLinecap="round"
					strokeLinejoin="round"
				/>
			</g>
			{/* front panel */}
			<path
				d="M11.2 34c.2-2.2 1.9-4 4.2-4h45.2c2.3 0 4 1.8 4.2 4l1.4 18c.2 2.2-1.5 4-3.8 4H13.6c-2.3 0-4-1.8-3.8-4l1.4-18z"
				fill="url(#cs-folder)"
			/>
		</svg>
	);
}

/* ---------- main ---------- */

export function CommandSearchMock() {
	const [query, setQuery] = useState("Codecraft");
	const trimmed = query.trim();
	const hasQuery = trimmed.length > 0;

	return (
		<div className="mock-cs">
			<section
				className="mock-cs__dialog"
				role="dialog"
				aria-label="Command search"
			>
				{/* search row */}
				<div className="mock-cs__searchrow">
					<Search size={17} aria-hidden="true" />
					<input
						value={query}
						onChange={(e) => setQuery(e.target.value)}
						placeholder="Search projects…"
						aria-label="Search projects"
					/>
					{hasQuery && (
						<button
							type="button"
							className="mock-cs__clear"
							onClick={() => setQuery("")}
						>
							Clear search
						</button>
					)}
				</div>

				{/* empty state */}
				<div className="mock-cs__body">
					<FolderIllustration />
					{hasQuery ? (
						<>
							<h2>No projects found</h2>
							<p className="mock-cs__sub">
								&ldquo;{trimmed}&rdquo; did not match any current projects.
								Please try again or{" "}
								<button type="button" className="mock-cs__link">
									create a new project
								</button>
								.
							</p>
						</>
					) : (
						<>
							<h2>Search projects</h2>
							<p className="mock-cs__sub">
								Type a project name to search current projects.
							</p>
						</>
					)}
					<div className="mock-cs__actions">
						{hasQuery && (
							<Button variant="secondary" onClick={() => setQuery("")}>
								Clear search
							</Button>
						)}
						<Button className="mock-cs__create">Create project</Button>
					</div>
				</div>

				{/* keyboard hints */}
				<footer className="mock-cs__footer">
					<span className="mock-cs__hint">
						<Kbd aria-label="Arrow up">
							<ArrowUp />
						</Kbd>
						<Kbd aria-label="Arrow down">
							<ArrowDown />
						</Kbd>
						Navigate
					</span>
					<span className="mock-cs__hint">
						<Kbd aria-label="Arrow left">
							<ArrowLeft />
						</Kbd>
						Return to parent
					</span>
					<span className="mock-cs__hint">
						<Kbd aria-label="Command">
							<Command />
						</Kbd>
						<Kbd aria-label="Return">
							<CornerDownLeft />
						</Kbd>
						Open new tab
					</span>
					<span className="mock-cs__hint mock-cs__hint--end">
						<Kbd>esc</Kbd>
						Close
					</span>
				</footer>
			</section>
		</div>
	);
}
