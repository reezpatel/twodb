import { Navigate } from "react-router";
import { useTree } from "../hooks/use-tree.hook";

export function NotesIndex() {
	const tree = useTree();

	if (!tree.data) return null;

	const first = tree.data
		.filter((node) => node.type === "section" && node.parent_id === null)
		.sort((a, b) => a.position - b.position)[0];

	if (!first) return null;

	return <Navigate to={`/notes/${first.identifier}`} replace />;
}
