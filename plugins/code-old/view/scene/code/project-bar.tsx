import { IconButton } from "@twodb/ui";
import { Code2, Filter, Folder, GitBranch, Tag } from "lucide-react";
import { projectBarStyles } from "./project-bar.style";

const ACTIONS = [
	{ id: "git", icon: GitBranch },
	{ id: "folder", icon: Folder },
	{ id: "github", icon: Code2 },
	{ id: "tags", icon: Tag },
	{ id: "filter", icon: Filter },
];

export function ProjectBar() {
	return (
		<div className="code-project-bar">
			<style jsx>{projectBarStyles}</style>
			<span className="code-project-bar__name">my-project</span>
			<div className="code-project-bar__actions">
				{ACTIONS.map((action) => (
					<IconButton
						key={action.id}
						label={action.id}
						size="sm"
						icon={<action.icon size={16} />}
					/>
				))}
			</div>
		</div>
	);
}
