import { useState } from "react";
import { Button, IconButton } from "@twodb/ui";
import { ArrowLeftRight, BookOpen, Check, Copy, X } from "lucide-react";
import "./PermissionModel.css";

/* ---------- App Icons ---------- */

function UntitledIcon() {
	return (
		<span className="mock-pm__app-icon mock-pm__app-icon--dark">
			<svg width="24" height="24" viewBox="0 0 24 24" fill="none">
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

function LovableIcon() {
	return (
		<span className="mock-pm__app-icon mock-pm__app-icon--gradient">
			<svg width="24" height="24" viewBox="0 0 24 24" fill="none">
				<defs>
					<linearGradient id="lovable-grad" x1="0" y1="0" x2="1" y2="1">
						<stop offset="0%" stopColor="#ff6b6b" />
						<stop offset="50%" stopColor="#feca57" />
						<stop offset="100%" stopColor="#ff9ff3" />
					</linearGradient>
				</defs>
				<path
					d="M12 21C12 21 4 15 4 9.5C4 6.5 6.5 4 9.5 4C11.04 4 12.54 4.99 13 6C13.46 4.99 14.96 4 16.5 4C19.5 4 22 6.5 22 9.5C22 15 14 21 12 21Z"
					fill="url(#lovable-grad)"
				/>
			</svg>
		</span>
	);
}

/* ---------- Permission List ---------- */

const PERMISSIONS = [
	"Import and sync Lovable UI components",
	"Access your design system and tokens",
	"Preview and insert components in real time",
	"Auto-update components as your system evolves",
	"Manage shared styles and libraries across teams",
];

/* ---------- Main Component ---------- */

export function PermissionModelMock() {
	const [copied, setCopied] = useState(false);
	const [isOpen, setIsOpen] = useState(true);

	const integrationUrl = "untitledui.com/integrations/lovable";

	const handleCopy = () => {
		navigator.clipboard.writeText(`https://${integrationUrl}`);
		setCopied(true);
		setTimeout(() => setCopied(false), 2000);
	};

	if (!isOpen) {
		return (
			<div className="mock-pm__closed">
				<Button onClick={() => setIsOpen(true)}>Open Permission Dialog</Button>
			</div>
		);
	}

	return (
		<div className="mock-pm__backdrop">
			<div className="mock-pm__dialog" role="dialog" aria-labelledby="pm-title">
				{/* Close Button */}
				<IconButton
					icon={<X size={18} />}
					label="Close dialog"
					variant="ghost"
					size="sm"
					className="mock-pm__close"
					onClick={() => setIsOpen(false)}
				/>

				{/* App Icons Header */}
				<div className="mock-pm__icons">
					<UntitledIcon />
					<span className="mock-pm__arrows">
						<ArrowLeftRight size={16} />
					</span>
					<LovableIcon />
				</div>

				{/* Title & Description */}
				<h2 id="pm-title" className="mock-pm__title">
					Connect Untitled to Lovable
				</h2>
				<p className="mock-pm__desc">
					Design and ship faster with beautiful, prebuilt components that plug
					straight into your workflow.
				</p>

				{/* Permissions Section */}
				<div className="mock-pm__permissions">
					<h3 className="mock-pm__section-title">Untitled would like to</h3>
					<ul className="mock-pm__list">
						{PERMISSIONS.map((perm, idx) => (
							<li key={idx}>
								<Check size={16} aria-hidden="true" />
								<span>{perm}</span>
							</li>
						))}
					</ul>
				</div>

				{/* URL Field */}
				<div className="mock-pm__url-field">
					<span className="mock-pm__url">{integrationUrl}</span>
					<IconButton
						icon={copied ? <Check size={14} /> : <Copy size={14} />}
						label="Copy URL"
						variant="ghost"
						size="sm"
						onClick={handleCopy}
					/>
				</div>

				{/* Footer Actions */}
				<div className="mock-pm__footer">
					<Button variant="secondary" className="mock-pm__docs-btn">
						<BookOpen size={16} aria-hidden="true" />
						Documentation
					</Button>
					<Button>Connect</Button>
				</div>
			</div>
		</div>
	);
}
