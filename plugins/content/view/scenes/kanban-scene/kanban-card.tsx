import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { ContentRowDto } from "@twodb/contracts";
import { ListItem } from "../../components/list-item/list-item";
import { kanbanCardStyles } from "./kanban-card.style";

type KanbanCardProps = {
	note: ContentRowDto;
	open: boolean;
	onOpen: (id: string) => void;
};

export function KanbanCard({ note, open, onOpen }: KanbanCardProps) {
	const {
		attributes,
		listeners,
		setNodeRef,
		transform,
		transition,
		isDragging,
	} = useSortable({ id: note.id });

	return (
		<div
			ref={setNodeRef}
			style={{ transform: CSS.Transform.toString(transform), transition }}
			className={`kanban-card${isDragging ? " is-dragging" : ""}`}
			{...attributes}
			{...listeners}
		>
			<style jsx>{kanbanCardStyles}</style>
			<ListItem note={note} open={open} onOpen={onOpen} />
		</div>
	);
}
