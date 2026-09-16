import { useNavigate } from "react-router";
import { SettingsLayout } from "@twodb/shared-frontend";
import { Button } from "@twodb/ui";
import { agentSettingsPath } from "../lib/paths";
import { getProviderConfigurators } from "../lib/provider-registry";
import { ProviderTemplatePicker } from "./provider-template-picker";
import { agentSettingsStyles } from "./agent-settings.style";

export function AgentNewScene() {
	const navigate = useNavigate();
	const providers = getProviderConfigurators();

	return (
		<SettingsLayout>
			<style jsx>{agentSettingsStyles}</style>
			<div className="agent-settings">
				<header className="agent-settings__header">
					<div>
						<h3>Add agent</h3>
						<p>Choose a provider to connect.</p>
					</div>
					<Button
						variant="ghost"
						size="sm"
						onClick={() => navigate(agentSettingsPath())}
					>
						Back
					</Button>
				</header>

				{providers.length === 0 && (
					<div className="agent-settings__state">
						No providers installed — enable an agent provider plugin first.
					</div>
				)}

				<ProviderTemplatePicker
					options={providers.map((provider) => ({
						id: provider.providerId,
						label: provider.label,
					}))}
					onSelect={(option) =>
						navigate(agentSettingsPath(`/new/${option.id}`))
					}
				/>
			</div>
		</SettingsLayout>
	);
}
