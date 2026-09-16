import { useParams } from "react-router";
import { SettingsLayout, useTwoDbPlugin } from "@twodb/shared-frontend";
import { settingsSceneStyles } from "./settings-scene.style";

/**
 * Generic settings route (/settings/:pluginId?). Plugins with their own
 * settings routes (registered via core::add_routes under
 * /settings/<plugin.id>) win by static-segment ranking; this scene covers
 * the rail-only and no-settings-provided states for the rest.
 */
export const SettingsScene = () => {
	const { plugins } = useTwoDbPlugin();
	const { pluginId } = useParams();

	const selected = plugins.find((p) => p.id === pluginId);

	return (
		<SettingsLayout>
			<style jsx>{settingsSceneStyles}</style>
			{!selected ? (
				<div className="settings__empty">
					<h3>Select a plugin</h3>
					<p>Choose a plugin from the list to view its settings.</p>
				</div>
			) : (
				<div className="settings__empty">
					<h3>{selected.name}</h3>
					<p>No settings provided by this plugin.</p>
				</div>
			)}
		</SettingsLayout>
	);
};
