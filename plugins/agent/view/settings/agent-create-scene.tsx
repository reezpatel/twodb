import { Navigate, useNavigate, useParams } from "react-router";
import { SettingsLayout } from "@twodb/shared-frontend";
import { Button, Input, Select } from "@twodb/ui";
import { useAgentCreate } from "../hooks/use-agent-create";
import { agentSettingsPath } from "../lib/paths";
import { getProviderConfigurator } from "../lib/provider-registry";
import { agentSettingsStyles } from "./agent-settings.style";

export function AgentCreateScene() {
	const { providerId } = useParams();
	const navigate = useNavigate();
	const provider = providerId ? getProviderConfigurator(providerId) : undefined;

	const { nameForm, handleNewAuth, submitError } = useAgentCreate(
		provider?.providerId ?? "",
		() => navigate(agentSettingsPath()),
		provider?.label ?? "",
		provider?.models,
	);

	if (!provider) {
		return <Navigate to={agentSettingsPath("/new")} replace />;
	}

	const Configurator = provider.component;

	return (
		<SettingsLayout>
			<style jsx>{agentSettingsStyles}</style>
			<div className="agent-settings">
				<header className="agent-settings__header">
					<div>
						<h3>Add agent — {provider.label}</h3>
						<p>
							Credentials are encrypted at rest; secret fields never leave the
							api.
						</p>
					</div>
					<Button
						variant="ghost"
						size="sm"
						onClick={() => navigate(agentSettingsPath("/new"))}
					>
						Back
					</Button>
				</header>

				<nameForm.Field
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
							placeholder={`e.g. ${provider.label} — personal`}
						/>
					)}
				</nameForm.Field>

				{provider.models?.length ? (
					<nameForm.Field
						name="model"
						validators={{
							onChange: ({ value }) =>
								value.trim().length === 0 ? "Pick a model" : undefined,
						}}
					>
						{(field) => (
							<Select
								label="Model"
								options={provider.models!.map((model) => ({
									value: model.id,
									label: model.label,
								}))}
								value={field.state.value}
								onValueChange={(value) => field.handleChange(value)}
								error={field.state.meta.errors[0]?.toString()}
							/>
						)}
					</nameForm.Field>
				) : (
					<nameForm.Field name="model">
						{(field) => (
							<Input
								label="Model"
								value={field.state.value}
								onChange={(e) => field.handleChange(e.target.value)}
								onBlur={field.handleBlur}
								placeholder="e.g. kimi-for-coding"
							/>
						)}
					</nameForm.Field>
				)}

				<Configurator onNewAuth={handleNewAuth} />

				{submitError && (
					<div className="agent-settings__state">{submitError}</div>
				)}
			</div>
		</SettingsLayout>
	);
}
