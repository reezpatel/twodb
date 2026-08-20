import { Workflow } from "lucide-react";
import { WorkspaceScene } from "../workspace/workspace-scene";

export function AutomationsScene() {
	return (
		<WorkspaceScene
			icon={<Workflow size={15} />}
			title="Automations"
			description="Automations will turn plain-language routines into repeatable work."
		/>
	);
}
