import { Navigate, useNavigate, useParams } from "react-router";
import { SettingsLayout } from "@twodb/shared-frontend";
import { Button, Input, Select, Switch } from "@twodb/ui";
import type { AgentDto } from "../../shared/types";
import { useAgentEdit } from "../hooks/use-agent-edit";
import { useAgents } from "../hooks/use-agents";
import { agentSettingsPath } from "../lib/paths";
import { getProviderConfigurator } from "../lib/provider-registry";
import { agentEditStyles } from "./agent-edit-scene.style";
import { agentSettingsStyles } from "./agent-settings.style";

export function AgentEditScene() {
	const { agentId } = useParams();
	const agents = useAgents();
	const navigate = useNavigate();

	const agent = agents.data?.find((a) => a.id === agentId);

	if (agents.data && !agent) {
		return <Navigate to={agentSettingsPath()} replace />;
	}

	return (
		<SettingsLayout>
			<style jsx>{agentSettingsStyles}</style>
			<div className="agent-settings">
				<header className="agent-settings__header">
					<div>
						<h3>Edit{agent ? ` — ${agent.name}` : ""}</h3>
						<p>
							{agent
								? (getProviderConfigurator(agent.provider)?.label ??
									agent.provider)
								: ""}
						</p>
					</div>
					<Button
						variant="ghost"
						size="sm"
						onClick={() => navigate(agentSettingsPath())}
					>
						Back
					</Button>
				</header>

				{agents.isPending && (
					<div className="agent-settings__state">Loading…</div>
				)}

				{agent && (
					<AgentEditForm
						agent={agent}
						onSaved={() => navigate(agentSettingsPath())}
					/>
				)}
			</div>
		</SettingsLayout>
	);
}

function AgentEditForm({
	agent,
	onSaved,
}: {
	agent: AgentDto;
	onSaved: () => void;
}) {
	const models = getProviderConfigurator(agent.provider)?.models;
	const { form, isPending, submitError } = useAgentEdit(agent, onSaved, models);
	const navigate = useNavigate();

	return (
		<form
			className="agent-edit"
			onSubmit={(e) => {
				e.preventDefault();
				form.handleSubmit();
			}}
		>
			<style jsx>{agentEditStyles}</style>

			<form.Field
				name="name"
				validators={{
					onChange: ({ value }) =>
						value.trim().length === 0 ? "Name is required" : undefined,
				}}
			>
				{(field) => (
					<Input
						label="Connection name"
						value={field.state.value}
						onChange={(e) => field.handleChange(e.target.value)}
						onBlur={field.handleBlur}
						error={field.state.meta.errors[0]?.toString()}
					/>
				)}
			</form.Field>

			{models?.length ? (
				<form.Field name="model">
					{(field) => (
						<Select
							label="Model"
							options={models.map((model) => ({
								value: model.id,
								label: model.label,
							}))}
							value={field.state.value}
							onValueChange={(value) => field.handleChange(value)}
						/>
					)}
				</form.Field>
			) : (
				<form.Field name="model">
					{(field) => (
						<Input
							label="Model"
							value={field.state.value}
							onChange={(e) => field.handleChange(e.target.value)}
							onBlur={field.handleBlur}
							placeholder="e.g. kimi-for-coding"
						/>
					)}
				</form.Field>
			)}

			<form.Field name="enabled">
				{(field) => (
					<Switch
						label="Enabled"
						checked={field.state.value}
						onChange={(e) => field.handleChange(e.target.checked)}
					/>
				)}
			</form.Field>

			<p className="agent-edit__note">
				To rotate credentials, delete this connection and add it again.
			</p>

			{submitError && <div className="agent-edit__error">{submitError}</div>}

			<div className="agent-edit__actions">
				<Button
					variant="ghost"
					type="button"
					onClick={() => navigate(agentSettingsPath())}
				>
					Cancel
				</Button>
				<Button type="submit" disabled={isPending}>
					{isPending ? "Saving…" : "Save changes"}
				</Button>
			</div>
		</form>
	);
}
