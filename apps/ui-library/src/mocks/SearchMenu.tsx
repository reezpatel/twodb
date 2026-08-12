import { useState } from "react";
import { Avatar, Switch } from "@twodb/ui";
import { ArrowLeft, Moon, Search, Settings } from "lucide-react";
import "./SearchMenu.css";

/* ---------- Integration Icons (exact brand colors) ---------- */

function GitHubIcon() {
	return (
		<svg className="mock-sm__svg" viewBox="0 0 24 24" fill="currentColor">
			<path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
		</svg>
	);
}

function LinearIcon() {
	return (
		<svg className="mock-sm__svg" viewBox="0 0 100 100" fill="none">
			<path
				d="M1.22541 61.5228c-.2225-.9485.90748-1.5459 1.59638-.857L39.3342 97.1782c.6889.6889.0915 1.8189-.857 1.5765C17.7164 93.5048 5.0152 80.8038 1.22541 61.5228zM.00189865 46.8891c-.01764375.2833.08887215.5599.29573765.7667l52.047424 52.0474c.2068.2069.4834.3134.7667.2958 3.1265-.1949 6.2022-.7381 9.1686-1.6151.2773-.0821.5224-.2644.6782-.5047.1559-.2403.2117-.5305.1544-.8033L15.8905 49.9538c-.1246-.5945-.5401-1.0863-1.1097-1.3145C9.57854 46.3385 4.54432 44.3527.00189865 46.8891zM3.52136 70.0969c-.02479.283.07958.5622.2893.7719l35.0867 35.0869c.2097.2097.4889.3141.7719.2893 2.5319-.2219 5.0243-.6764 7.4582-1.3548l.0018-.0002c.2912-.0813.5449-.275.7062-.5389.1613-.2639.2152-.5814.15-.8825l-.0004-.0015L12.5463 68.0267c-.2911-.6031-.7756-1.0777-1.3871-1.3581-1.9858-.9103-4.0638-1.6128-6.20192-2.0964-.26185-.0592-.53445-.0044-.75785.1522-.22341.1566-.3798.3978-.43424.6704-.3851 1.9267-.50197 3.8945-.24307 5.902z"
				fill="url(#linear-gradient)"
			/>
			<defs>
				<linearGradient id="linear-gradient" x1="0" y1="100" x2="100" y2="0">
					<stop stopColor="#5E6AD2" />
					<stop offset="1" stopColor="#8B5CF6" />
				</linearGradient>
			</defs>
		</svg>
	);
}

function FigmaIcon() {
	return (
		<svg className="mock-sm__svg" viewBox="0 0 24 24" fill="none">
			<path
				d="M8 24c2.208 0 4-1.792 4-4v-4H8c-2.208 0-4 1.792-4 4s1.792 4 4 4z"
				fill="#0ACF83"
			/>
			<path
				d="M4 12c0-2.208 1.792-4 4-4h4v8H8c-2.208 0-4-1.792-4-4z"
				fill="#A259FF"
			/>
			<path
				d="M4 4c0-2.208 1.792-4 4-4h4v8H8C5.792 8 4 6.208 4 4z"
				fill="#F24E1E"
			/>
			<path d="M12 0h4c2.208 0 4 1.792 4 4s-1.792 4-4 4h-4V0z" fill="#FF7262" />
			<path
				d="M20 12c0 2.208-1.792 4-4 4s-4-1.792-4-4 1.792-4 4-4 4 1.792 4 4z"
				fill="#1ABCFE"
			/>
		</svg>
	);
}

function ZapierIcon() {
	return (
		<svg className="mock-sm__svg" viewBox="0 0 24 24" fill="#FF4A00">
			<path d="M12 0L14.59 9.41L24 12L14.59 14.59L12 24L9.41 14.59L0 12L9.41 9.41L12 0Z" />
		</svg>
	);
}

function NotionIcon() {
	return (
		<svg className="mock-sm__svg" viewBox="0 0 24 24" fill="currentColor">
			<path d="M4.459 4.208c.746.606 1.026.56 2.428.466l13.215-.793c.28 0 .047-.28-.046-.326L17.86 1.968c-.42-.326-.981-.7-2.055-.607L3.01 2.295c-.466.046-.56.28-.374.466l1.823 1.447zm.793 3.08v13.904c0 .747.373 1.027 1.214.98l14.523-.84c.841-.046.934-.56.934-1.167V6.354c0-.606-.233-.933-.747-.886l-15.177.887c-.56.047-.747.327-.747.933zm14.337.745c.093.42 0 .84-.42.888l-.7.14v10.264c-.608.327-1.168.514-1.635.514-.747 0-.934-.234-1.495-.933l-4.577-7.186v6.952l1.448.327s0 .84-1.168.84l-3.22.186c-.093-.186 0-.653.327-.746l.84-.233V9.854L7.822 9.76c-.094-.42.14-1.026.793-1.073l3.454-.233 4.764 7.279v-6.44l-1.215-.14c-.093-.514.28-.887.747-.933l3.224-.187zM2.2 1.155l13.728-.933c1.682-.14 2.1.093 2.8.606L22.26 3.62c.467.374.607.467.607 1.027v15.677c0 .98-.327 1.587-1.494 1.68l-15.457.934c-.886.046-1.308-.094-1.774-.7L1.126 18.73c-.513-.7-.746-1.213-.746-1.82V2.835c0-.7.327-1.353 1.82-1.68z" />
		</svg>
	);
}

function SlackIcon() {
	return (
		<svg className="mock-sm__svg" viewBox="0 0 24 24" fill="none">
			<path
				d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zm1.271 0a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313z"
				fill="#E01E5A"
			/>
			<path
				d="M8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zm0 1.271a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312z"
				fill="#36C5F0"
			/>
			<path
				d="M18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zm-1.27 0a2.528 2.528 0 0 1-2.522 2.521 2.528 2.528 0 0 1-2.52-2.521V2.522A2.528 2.528 0 0 1 15.165 0a2.528 2.528 0 0 1 2.521 2.522v6.312z"
				fill="#2EB67D"
			/>
			<path
				d="M15.165 18.956a2.528 2.528 0 0 1 2.521 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zm0-1.27a2.527 2.527 0 0 1-2.52-2.522 2.527 2.527 0 0 1 2.52-2.52h6.313A2.528 2.528 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.521h-6.313z"
				fill="#ECB22E"
			/>
		</svg>
	);
}

function DropboxIcon() {
	return (
		<svg className="mock-sm__svg" viewBox="0 0 24 24" fill="#0061FF">
			<path d="M6 2l6 3.75L6 9.5 0 5.75 6 2zm12 0l6 3.75-6 3.75-6-3.75L18 2zM0 13.25L6 9.5l6 3.75L6 17 0 13.25zm18-3.75l6 3.75L18 17l-6-3.75 6-3.75zM6 18.25l6-3.75 6 3.75L12 22l-6-3.75z" />
		</svg>
	);
}

/* Large icons for detail panel */
function UntitledIconLarge() {
	return (
		<span className="mock-sm__app-icon">
			<svg width="22" height="22" viewBox="0 0 24 24" fill="none">
				<path
					d="M12 3L4 7.5V16.5L12 21L20 16.5V7.5L12 3Z"
					stroke="white"
					strokeWidth="1.5"
					strokeLinejoin="round"
				/>
				<path
					d="M12 12L4 7.5M12 12V21M12 12L20 7.5"
					stroke="white"
					strokeWidth="1.5"
					strokeLinejoin="round"
				/>
			</svg>
		</span>
	);
}

function LinearIconLarge() {
	return (
		<span className="mock-sm__app-icon mock-sm__app-icon--light">
			<svg width="22" height="22" viewBox="0 0 100 100" fill="none">
				<path
					d="M1.22541 61.5228c-.2225-.9485.90748-1.5459 1.59638-.857L39.3342 97.1782c.6889.6889.0915 1.8189-.857 1.5765C17.7164 93.5048 5.0152 80.8038 1.22541 61.5228zM.00189865 46.8891c-.01764375.2833.08887215.5599.29573765.7667l52.047424 52.0474c.2068.2069.4834.3134.7667.2958 3.1265-.1949 6.2022-.7381 9.1686-1.6151.2773-.0821.5224-.2644.6782-.5047.1559-.2403.2117-.5305.1544-.8033L15.8905 49.9538c-.1246-.5945-.5401-1.0863-1.1097-1.3145C9.57854 46.3385 4.54432 44.3527.00189865 46.8891zM3.52136 70.0969c-.02479.283.07958.5622.2893.7719l35.0867 35.0869c.2097.2097.4889.3141.7719.2893 2.5319-.2219 5.0243-.6764 7.4582-1.3548l.0018-.0002c.2912-.0813.5449-.275.7062-.5389.1613-.2639.2152-.5814.15-.8825l-.0004-.0015L12.5463 68.0267c-.2911-.6031-.7756-1.0777-1.3871-1.3581-1.9858-.9103-4.0638-1.6128-6.20192-2.0964-.26185-.0592-.53445-.0044-.75785.1522-.22341.1566-.3798.3978-.43424.6704-.3851 1.9267-.50197 3.8945-.24307 5.902z"
					fill="url(#linear-gradient-lg)"
				/>
				<defs>
					<linearGradient
						id="linear-gradient-lg"
						x1="0"
						y1="100"
						x2="100"
						y2="0"
					>
						<stop stopColor="#5E6AD2" />
						<stop offset="1" stopColor="#8B5CF6" />
					</linearGradient>
				</defs>
			</svg>
		</span>
	);
}

/* ---------- Data ---------- */

interface Integration {
	id: string;
	name: string;
	domain: string;
	icon: React.ReactNode;
}

const INTEGRATIONS: Integration[] = [
	{ id: "github", name: "GitHub", domain: "github.com", icon: <GitHubIcon /> },
	{ id: "linear", name: "Linear", domain: "linear.app", icon: <LinearIcon /> },
	{ id: "figma", name: "Figma", domain: "figma.com", icon: <FigmaIcon /> },
	{ id: "zapier", name: "Zapier", domain: "zapier.com", icon: <ZapierIcon /> },
	{ id: "notion", name: "Notion", domain: "notion.so", icon: <NotionIcon /> },
	{ id: "slack", name: "Slack", domain: "slack.com", icon: <SlackIcon /> },
	{
		id: "dropbox",
		name: "Dropbox",
		domain: "dropbox.com",
		icon: <DropboxIcon />,
	},
];

/* ---------- Main Component ---------- */

export function SearchMenuMock() {
	const [query, setQuery] = useState("");
	const [selected, setSelected] = useState("linear");
	const [enabled, setEnabled] = useState(true);

	const filtered = INTEGRATIONS.filter(
		(i) =>
			i.name.toLowerCase().includes(query.toLowerCase()) ||
			i.domain.toLowerCase().includes(query.toLowerCase()),
	);

	const selectedIntegration = INTEGRATIONS.find((i) => i.id === selected);

	return (
		<div className="mock-sm">
			<div className="mock-sm__dialog">
				{/* Header */}
				<div className="mock-sm__header">
					<button className="mock-sm__back" aria-label="Go back">
						<ArrowLeft size={16} />
					</button>
					<span className="mock-sm__title">Integrations</span>
				</div>

				{/* Search */}
				<div className="mock-sm__search">
					<Search size={16} className="mock-sm__search-icon" />
					<input
						type="text"
						placeholder="Search for integrations"
						value={query}
						onChange={(e) => setQuery(e.target.value)}
					/>
					<span className="mock-sm__shortcut">⌘/</span>
				</div>

				{/* Content */}
				<div className="mock-sm__content">
					{/* List */}
					<div className="mock-sm__list">
						{filtered.map((integration) => (
							<button
								key={integration.id}
								className={`mock-sm__item ${selected === integration.id ? "is-selected" : ""}`}
								onClick={() => setSelected(integration.id)}
							>
								<span className="mock-sm__item-icon">{integration.icon}</span>
								<span className="mock-sm__item-name">{integration.name}</span>
								<span className="mock-sm__item-domain">
									{integration.domain}
								</span>
							</button>
						))}
					</div>

					{/* Detail Panel */}
					{selectedIntegration && (
						<div className="mock-sm__detail">
							{/* App Icons */}
							<div className="mock-sm__detail-icons">
								<UntitledIconLarge />
								<svg
									className="mock-sm__arrows"
									width="20"
									height="20"
									viewBox="0 0 20 20"
									fill="none"
								>
									<path
										d="M4 10H16M16 10L13 7M16 10L13 13"
										stroke="currentColor"
										strokeWidth="1.5"
										strokeLinecap="round"
										strokeLinejoin="round"
									/>
									<path
										d="M16 10H4M4 10L7 7M4 10L7 13"
										stroke="currentColor"
										strokeWidth="1.5"
										strokeLinecap="round"
										strokeLinejoin="round"
										opacity="0.4"
									/>
								</svg>
								<LinearIconLarge />
							</div>

							{/* Info */}
							<div className="mock-sm__detail-info">
								<div className="mock-sm__detail-title-row">
									<h3>Untitled + {selectedIntegration.name}</h3>
									<Switch
										checked={enabled}
										onChange={(e) => setEnabled(e.target.checked)}
										aria-label="Enable integration"
									/>
								</div>
								<p className="mock-sm__detail-date">Updated May 26, 2024</p>
								<div className="mock-sm__detail-author">
									<Avatar name="Frankie Sullivan" size="sm" />
									<span>
										by <strong>Frankie Sullivan</strong>
									</span>
									<button className="mock-sm__more" aria-label="More options">
										•••
									</button>
								</div>
							</div>

							{/* Action */}
							<button className="mock-sm__explore">Explore integration</button>
						</div>
					)}
				</div>

				{/* Footer */}
				<div className="mock-sm__footer">
					<div className="mock-sm__hints">
						<kbd>↑</kbd>
						<kbd>↓</kbd>
						<span>to navigate</span>
						<kbd>↵</kbd>
						<span>to select</span>
						<kbd>esc</kbd>
						<span>to close</span>
						<kbd>←</kbd>
						<span>return to parent</span>
					</div>
					<div className="mock-sm__footer-icons">
						<button className="mock-sm__footer-btn" aria-label="Settings">
							<Settings size={16} />
						</button>
						<button className="mock-sm__footer-btn" aria-label="Toggle theme">
							<Moon size={16} />
						</button>
					</div>
				</div>
			</div>
		</div>
	);
}
