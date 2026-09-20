import { useEffect, useMemo } from "react";
import { useNavigate, useParams } from "react-router";
import { SettingsLayout, useTwoDbPlugin } from "@twodb/shared-frontend";
import { settingsSceneStyles } from "./settings-scene.style";

/**
 * Generic settings route (/settings/:pluginId?). Renders the selected
 * plugin's workspace.settings node (ViewPlugin) inside the shared chrome;
 * plugins with their own routes still win by static-segment ranking.
 */
export const SettingsScene = () => {
  const { plugins } = useTwoDbPlugin();
  const { pluginId } = useParams();
  const navigate = useNavigate();

  const withSettings = useMemo(() => plugins.filter((plugin) => plugin.workspace?.settings != null), [plugins]);
  const selected = plugins.find((plugin) => plugin.id === pluginId);

  useEffect(() => {
    if (!pluginId && withSettings.length > 0) {
      navigate(`/settings/${withSettings[0]!.id}`, { replace: true });
    }
  }, [pluginId, withSettings, navigate]);

  return (
    <SettingsLayout>
      <style jsx>{settingsSceneStyles}</style>
      {selected?.workspace?.settings != null ? (
        selected.workspace.settings
      ) : !selected ? (
        <div className="settings__empty">
          <h3>Select a plugin</h3>
          <p>Choose a plugin from the list to view its settings.</p>
        </div>
      ) : (
        <div className="settings__empty">
          <h3>{selected.id}</h3>
          <p>No settings provided by this plugin.</p>
        </div>
      )}
    </SettingsLayout>
  );
};
