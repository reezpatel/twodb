import { useState } from "react";

export type CodeView = "code" | "chat";

export function useCodeScene() {
	const [view, setView] = useState<CodeView>("chat");
	const [selectedSessionId, setSelectedSessionId] = useState("s3");

	return {
		view,
		setView,
		selectedSessionId,
		selectSession: setSelectedSessionId,
	};
}
