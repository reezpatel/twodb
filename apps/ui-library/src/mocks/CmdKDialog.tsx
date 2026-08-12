import { useState, useCallback } from "react";
import "./CmdKDialog.css";

interface AppIcon {
	id: string;
	name: string;
	color: string;
	position: {
		top: string;
		left: string;
		rotation: number;
	};
}

const APP_ICONS: AppIcon[] = [
	{
		id: "1",
		name: "Figma",
		color: "#0ACF83",
		position: { top: "20%", left: "15%", rotation: -15 },
	},
	{
		id: "2",
		name: "Slack",
		color: "#4A154B",
		position: { top: "25%", left: "35%", rotation: 10 },
	},
	{
		id: "3",
		name: "Zoom",
		color: "#2D8CFF",
		position: { top: "35%", left: "25%", rotation: -8 },
	},
	{
		id: "4",
		name: "GitHub",
		color: "#181717",
		position: { top: "55%", left: "65%", rotation: 12 },
	},
	{
		id: "5",
		name: "Notion",
		color: "#000000",
		position: { top: "20%", left: "60%", rotation: -10 },
	},
	{
		id: "6",
		name: "Linear",
		color: "#5E6AD2",
		position: { top: "45%", left: "75%", rotation: 8 },
	},
	{
		id: "7",
		name: "Raycast",
		color: "#FF6363",
		position: { top: "35%", left: "80%", rotation: -12 },
	},
	{
		id: "8",
		name: "Spotify",
		color: "#1DB954",
		position: { top: "50%", left: "20%", rotation: 15 },
	},
];

function AppIcon({ icon }: { icon: AppIcon }) {
	const initials = icon.name.slice(0, 2).toUpperCase();
	return (
		<div
			className="mock-cmdk__app-icon"
			style={{
				top: icon.position.top,
				left: icon.position.left,
				transform: `rotate(${icon.position.rotation}deg)`,
			}}
			aria-label={icon.name}
		>
			<div
				className="mock-cmdk__app-icon-bg"
				style={{ backgroundColor: icon.color }}
			>
				<span>{initials}</span>
			</div>
		</div>
	);
}

export function CmdKDialogMock() {
	const [query, setQuery] = useState("Adobe XD");

	const handleClear = useCallback(() => {
		setQuery("");
	}, []);

	const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
		if (e.key === "Escape") {
			setQuery("");
		}
	}, []);

	return (
		<div className="mock-cmdk">
			<div className="mock-cmdk__wash mock-cmdk__wash--a" />
			<div className="mock-cmdk__wash mock-cmdk__wash--b" />

			<div className="mock-cmdk__dialog">
				{/* Header with Search Input */}
				<div className="mock-cmdk__header">
					<input
						type="text"
						className="mock-cmdk__input"
						placeholder="Search for apps and commands..."
						value={query}
						onChange={(e) => setQuery(e.target.value)}
						onKeyDown={handleKeyDown}
						autoFocus
					/>
					<div className="mock-cmdk__shortcut">
						<svg width="20" height="20" viewBox="0 0 20 20" fill="none">
							<path
								d="M10 2C11.1046 2 12 2.89543 12 4V6H14C15.1046 6 16 6.89543 16 8V10C16 11.1046 15.1046 12 14 12H12V14C12 15.1046 11.1046 16 10 16H8C6.89543 16 6 15.1046 6 14V12H4C2.89543 12 2 11.1046 2 10V8C2 6.89543 2.89543 6 4 6H6V4C6 2.89543 6.89543 2 8 2H10Z"
								stroke="currentColor"
								strokeWidth="1.5"
								strokeLinecap="round"
								strokeLinejoin="round"
							/>
							<path
								d="M10 6V14M6 10H14"
								stroke="currentColor"
								strokeWidth="1.5"
								strokeLinecap="round"
								strokeLinejoin="round"
								opacity="0.4"
							/>
						</svg>
						<span>K</span>
					</div>
				</div>

				{/* Main Content */}
				<div className="mock-cmdk__content">
					{/* Decorative App Icons Background */}
					<div className="mock-cmdk__icons-bg">
						<div className="mock-cmdk__ripple mock-cmdk__ripple--1" />
						<div className="mock-cmdk__ripple mock-cmdk__ripple--2" />
						<div className="mock-cmdk__ripple mock-cmdk__ripple--3" />
						{APP_ICONS.map((icon) => (
							<AppIcon key={icon.id} icon={icon} />
						))}
					</div>

					{/* Search Icon Center */}
					<div className="mock-cmdk__search-icon">
						<svg width="24" height="24" viewBox="0 0 24 24" fill="none">
							<circle
								cx="11"
								cy="11"
								r="7"
								stroke="currentColor"
								strokeWidth="2"
								strokeLinecap="round"
								strokeLinejoin="round"
							/>
							<path
								d="M20 20L17 17"
								stroke="currentColor"
								strokeWidth="2"
								strokeLinecap="round"
								strokeLinejoin="round"
							/>
						</svg>
					</div>

					{/* No Results Message */}
					<div className="mock-cmdk__message">
						<h3 className="mock-cmdk__message-title">Sorry, no results!</h3>
						<p className="mock-cmdk__message-text">
							We couldn't find any apps or commands.
							<br />
							Please try again or{" "}
							<a href="#" className="mock-cmdk__link">
								browse all apps
							</a>
							.
						</p>
					</div>

					{/* Clear Search Button */}
					<button
						type="button"
						className="mock-cmdk__clear-btn"
						onClick={handleClear}
					>
						Clear search
					</button>

					{/* Missing App Link */}
					<p className="mock-cmdk__footer-text">
						Missing an app?{" "}
						<a href="#" className="mock-cmdk__link">
							Let us know
						</a>
					</p>
				</div>
			</div>
		</div>
	);
}
