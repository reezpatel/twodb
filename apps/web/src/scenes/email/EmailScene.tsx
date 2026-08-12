import { Mail } from "lucide-react";
import { WorkspaceScene } from "../workspace/WorkspaceScene";

export function EmailScene() {
	return (
		<WorkspaceScene
			icon={<Mail size={15} />}
			title="Email"
			description="Email will collect messages, follow-ups, and context from your workspace."
		/>
	);
}
