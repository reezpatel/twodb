import { Button, Dialog, Select } from "@twodb/ui";
import type { useAgentModelDialog } from "../../hooks/use-agent-model-dialog.hook";

export function AgentModelDialog({
	dialog,
}: {
	dialog: ReturnType<typeof useAgentModelDialog>;
}) {
	return (
		<Dialog
			open={dialog.open}
			onClose={dialog.close}
			title="Provider & model"
			footer={
				<>
					<Button size="sm" variant="ghost" onClick={dialog.close}>
						Cancel
					</Button>
					<Button size="sm" disabled={dialog.saving} onClick={dialog.save}>
						{dialog.saving ? "Applying…" : "Apply"}
					</Button>
				</>
			}
		>
			<div
				style={{
					display: "flex",
					flexDirection: "column",
					gap: "var(--space-4)",
				}}
			>
				<Select
					label="Connection"
					options={dialog.agents.map((agent) => ({
						value: agent.id,
						label: agent.name,
					}))}
					value={dialog.draftAgentId}
					onValueChange={dialog.setDraftAgentId}
				/>
				{dialog.models.length > 0 ? (
					<Select
						label="Model"
						options={dialog.models.map((model) => ({
							value: model.id,
							label: model.label,
						}))}
						value={dialog.selectedModel}
						onValueChange={dialog.setDraftModel}
					/>
				) : (
					<p>
						This provider has no model catalog yet — set the model under
						Settings → Agents.
					</p>
				)}
				{dialog.error ? <p>{dialog.error}</p> : null}
			</div>
		</Dialog>
	);
}
