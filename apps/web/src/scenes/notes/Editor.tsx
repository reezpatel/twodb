/* Editor region — owns its chrome segment (doc type, slug, favorite, status,
   view actions, properties toggle) and the long-form document body. */

import { IconButton } from "@twodb/ui";
import {
	Code,
	Columns2,
	GripVertical,
	List,
	MoreHorizontal,
	PanelRight,
	Plus,
	Sparkles,
	Star,
} from "lucide-react";
import { editorStyles } from "./Editor.style";
import { useShellState } from "../../shell/state";

export function Editor() {
	const {
		openDoc,
		openTitle,
		starred,
		panelOpen,
		toggleStarred,
		setPanelOpen,
	} = useShellState();

	return (
		<>
			<style jsx>{editorStyles}</style>
			{/* top bar — editor segment */}
			<div className="shell__chrome shell__chrome--editor">
				<span className="shell__doctype">
					<span className="shell__doctypeicon">{openDoc.typeIcon}</span>
					{openDoc.type}
				</span>
				<span className="shell__slug">{openDoc.slug}</span>
				<span className="shell__chromespacer" />
				<IconButton
					active={starred}
					className="shell__barbtn shell__barbtn--star"
					icon={<Star size={14} fill={starred ? "currentColor" : "none"} />}
					label="Favorite"
					onClick={toggleStarred}
					size="sm"
				/>
				<span className="shell__statusdot" title={openDoc.status} />
				<IconButton
					className="shell__barbtn"
					icon={<Columns2 size={14} />}
					label="Split view"
					size="sm"
				/>
				<IconButton
					className="shell__barbtn"
					icon={<Code size={14} />}
					label="View source"
					size="sm"
				/>
				<IconButton
					className="shell__barbtn"
					icon={<Sparkles size={14} />}
					label="AI actions"
					size="sm"
				/>
				<IconButton
					className="shell__barbtn"
					icon={<List size={14} />}
					label="Outline"
					size="sm"
				/>
				{!panelOpen && (
					<IconButton
						className="shell__barbtn"
						icon={<PanelRight size={14} />}
						label="Show properties"
						onClick={() => setPanelOpen(true)}
						size="sm"
					/>
				)}
				<IconButton
					className="shell__barbtn"
					icon={<MoreHorizontal size={14} />}
					label="More actions"
					size="sm"
				/>
			</div>

			<main className="shell__editor">
				<div className="shell__doc">
					<h1 className="shell__doctitle">{openTitle}</h1>
					<div className="shell__blocks">
						<span className="shell__gutter" aria-hidden="true">
							<Plus size={14} />
							<GripVertical size={14} />
						</span>
						{openDoc.body}
					</div>
				</div>
			</main>
		</>
	);
}
