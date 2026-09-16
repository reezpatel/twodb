import { useEffect } from "react";
import { Button, Dialog, Select, Typeahead } from "@twodb/ui";
import { useProjectSelector } from "../../hooks/use-project-selector.hook";
import { projectSelectorStyles } from "./project-selector-dialog.style";

export function ProjectSelectorDialog({
	open,
	onClose,
}: {
	open: boolean;
	onClose: () => void;
}) {
	const {
		nodes,
		nodeId,
		setNodeId,
		agents,
		agentId,
		setAgentId,
		folderQuery,
		setFolderQuery,
		folderItems,
		folderLoading,
		selectedFolder,
		selectFolder,
		reset,
		submit,
		creating,
		createError,
	} = useProjectSelector(onClose);

	useEffect(() => {
		if (!open) reset();
	}, [open, reset]);

	return (
		<Dialog
			open={open}
			onClose={onClose}
			title="New project"
			footer={
				<Button
					size="sm"
					disabled={!nodeId || !selectedFolder || creating}
					onClick={submit}
				>
					{creating ? "Creating…" : "Create"}
				</Button>
			}
		>
			<style jsx>{projectSelectorStyles}</style>
			<div className="code-project-selector">
				<Select
					label="Node"
					placeholder="Select a node…"
					options={nodes}
					value={nodeId}
					onValueChange={setNodeId}
				/>
				<Select
					label="Agent"
					placeholder={
						agents.length > 0 ? "Select an agent…" : "No agents configured"
					}
					hint={
						agents.length > 0
							? undefined
							: "Create an agent in settings first — it drives the session."
					}
					options={agents}
					value={agentId}
					onValueChange={setAgentId}
				/>
				<Typeahead
					label="Folder"
					placeholder="Type to search folders…"
					hint={
						nodeId ? undefined : "Pick a node first — folders live on the node."
					}
					disabled={!nodeId}
					items={folderItems}
					query={folderQuery}
					onQueryChange={setFolderQuery}
					selected={selectedFolder}
					onSelect={selectFolder}
					loading={folderLoading}
					emptyMessage="No matching folders"
				/>
				{createError ? (
					<p className="code-project-selector__error">{createError}</p>
				) : null}
			</div>
		</Dialog>
	);
}
