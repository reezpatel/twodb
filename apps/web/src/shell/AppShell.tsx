import type { CSSProperties } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { AutomationsScene } from "../scenes/automations/AutomationsScene";
import { CalendarScene } from "../scenes/calendar/CalendarScene";
import { ChatScene } from "../scenes/chat/ChatScene";
import { CodeScene } from "../scenes/code/CodeScene";
import { EmailScene } from "../scenes/email/EmailScene";
import { FilesScene } from "../scenes/files/FilesScene";
import { InboxScene } from "../scenes/inbox/InboxScene";
import { NotesScene } from "../scenes/notes/NotesScene";
import { RecordingScene } from "../scenes/recording/RecordingScene";
import { Sidebar } from "./Sidebar";
import { StatusBar } from "./StatusBar";
import { appShellStyles } from "./AppShell.style";
import { CommandPalette } from "./CommandPalette";
import { ShellStateProvider, useShellState } from "./state";

function ShellFrame() {
	const { panelOpen, phase } = useShellState();
	const location = useLocation();
	const isInboxLayout = location.pathname === "/inbox";
	const classes = ["shell", isInboxLayout ? "shell--notes" : ""]
		.filter(Boolean)
		.join(" ");
	const shellStyle = {
		"--shell-columns": isInboxLayout
			? panelOpen
				? "212px 292px minmax(0, 1fr) 252px"
				: "212px 292px minmax(0, 1fr)"
			: "212px minmax(0, 1fr)",
	} as CSSProperties;

	return (
		<div className={classes} data-phase={phase} style={shellStyle}>
			<style jsx>{appShellStyles}</style>
			<Sidebar />
			<Routes>
				<Route path="/" element={<Navigate to="/inbox" replace />} />
				<Route path="/inbox" element={<InboxScene />} />
				<Route path="/email" element={<EmailScene />} />
				<Route path="/calendar" element={<CalendarScene />} />
				<Route path="/files" element={<FilesScene />} />
				<Route path="/automations" element={<AutomationsScene />} />
				<Route path="/chat" element={<ChatScene />} />
				<Route path="/code" element={<CodeScene />} />
				<Route path="/notes" element={<NotesScene />} />
				<Route path="/recording" element={<RecordingScene />} />
				<Route path="*" element={<Navigate to="/inbox" replace />} />
			</Routes>
			<StatusBar />
			<CommandPalette />
		</div>
	);
}

export function AppShell() {
	return (
		<ShellStateProvider>
			<ShellFrame />
		</ShellStateProvider>
	);
}
