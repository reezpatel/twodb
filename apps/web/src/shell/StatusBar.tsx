/* Status bar region — the git-flavored footer strip. Spans the full grid
   width, so it owns no chrome segment. Styles: StatusBar.style.jsx (styled-jsx). */

import {
	Asterisk,
	Bell,
	Check,
	CloudCheck,
	FlaskConical,
	Folder,
	GitCommitHorizontal,
	GitPullRequest,
	History,
} from "lucide-react";
import { statusBarStyles } from "./StatusBar.style";

export function StatusBar() {
	return (
		<footer className="shell__statusbar">
			<style jsx>{statusBarStyles}</style>
			<span className="shell__stitem">
				<Folder size={12} /> laputa
			</span>
			<span className="shell__stitem">
				<FlaskConical size={12} /> Alpha 2026.5.7.5
			</span>
			<span className="shell__stitem shell__stitem--changes">
				<i /> 3 Changes
			</span>
			<button type="button" className="shell__stitem shell__stbtn">
				<GitCommitHorizontal size={13} /> Commit
			</button>
			<span className="shell__stitem shell__stitem--synced">
				<CloudCheck size={13} /> Synced 2m ago
			</span>
			<button
				type="button"
				className="shell__stitem shell__stbtn shell__stitem--dim"
			>
				<History size={12} /> History
			</button>
			<span className="shell__chromespacer" />
			<span className="shell__stitem shell__stitem--claude">
				<Asterisk size={13} /> Claude
			</span>
			<button type="button" className="shell__stitem shell__stbtn">
				<GitPullRequest size={12} /> Contribute
			</button>
			<button
				type="button"
				className="shell__stbtnicon"
				aria-label="Notifications"
			>
				<Bell size={12} />
			</button>
			<button
				type="button"
				className="shell__stbtnicon"
				aria-label="Sync status"
			>
				<Check size={12} />
			</button>
		</footer>
	);
}
