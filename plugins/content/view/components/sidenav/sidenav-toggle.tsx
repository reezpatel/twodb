import { PanelLeft } from "lucide-react";
import { IconButton, Tooltip } from "@twodb/ui";
import { useNotesSidenav } from "../../hooks/use-notes-sidenav.hook";

export function SidenavToggle() {
	const { toggle } = useNotesSidenav();

	return (
		<Tooltip tip="Toggle sidebar">
			<IconButton
				label="Toggle notes sidebar"
				icon={<PanelLeft size={15} />}
				onClick={toggle}
			/>
		</Tooltip>
	);
}
