import { MessageCircle } from "lucide-react";
import { WorkspaceScene } from "../workspace/WorkspaceScene";

export function ChatScene() {
	return (
		<WorkspaceScene
			icon={<MessageCircle size={15} />}
			title="Chat"
			description="Chat will answer questions and help act on the knowledge inside twodb."
		/>
	);
}
