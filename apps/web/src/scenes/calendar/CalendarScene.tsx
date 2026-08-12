import { CalendarDays } from "lucide-react";
import { WorkspaceScene } from "../workspace/WorkspaceScene";

export function CalendarScene() {
	return (
		<WorkspaceScene
			icon={<CalendarDays size={15} />}
			title="Calendar"
			description="Calendar will organize appointments, reminders, and time-sensitive notes."
		/>
	);
}
