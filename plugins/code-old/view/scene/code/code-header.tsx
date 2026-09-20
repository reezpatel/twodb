import { IconButton } from "@twodb/ui";
import { MoreVertical, Plus } from "lucide-react";
import { useCodeHeader } from "../../hooks/use-code-header.hook";
import { ProjectSelectorDialog } from "./project-selector-dialog";
import { codeHeaderStyles } from "./code-header.style";

export function CodeHeader() {
	const { projectSelectorOpen, openProjectSelector, closeProjectSelector } =
		useCodeHeader();

	return (
		<header className="code-header">
			<style jsx>{codeHeaderStyles}</style>
			<span className="code-header__label">code</span>
			<div className="code-header__actions">
				<IconButton
					label="New"
					size="sm"
					icon={<Plus size={16} />}
					onClick={openProjectSelector}
				/>
				<IconButton label="Menu" size="sm" icon={<MoreVertical size={16} />} />
			</div>
			<ProjectSelectorDialog
				open={projectSelectorOpen}
				onClose={closeProjectSelector}
			/>
		</header>
	);
}
