import { NotebookPen } from "lucide-react";
import { ViewPlugin } from "@twodb/shared-frontend";
import manifest from "../manifest";
import { NotesScreen } from "./NotesScreen";

/**
 * Notes view — the react-pluggable half of the twodb.notes plugin.
 * Contributes a rail item and one index route; the shell mounts the route
 * at /twodb.notes automatically.
 */
export default class NotesViewPlugin extends ViewPlugin {
	readonly manifest = manifest;

	activate(): void {
		const screen = <NotesScreen api={this.api} bus={this.bus} />;
		this.contribute({
			railItem: {
				id: manifest.id,
				icon: <NotebookPen size={18} />,
				label: "Notes",
				order: 10,
			},
			routes: [{ path: "/", element: screen }],
		});
	}
}
