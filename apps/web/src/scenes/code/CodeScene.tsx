import { Code2 } from "lucide-react";
import { WorkspaceScene } from "../workspace/WorkspaceScene";

export function CodeScene() {
	return (
		<WorkspaceScene
			icon={<Code2 size={15} />}
			title="Code"
			description="Code will hold generated apps, implementation notes, and build activity."
		/>
	);
}
