import { NavPanel, NavPanelGroup, NavPanelItem, NavPanelSection } from "@twodb/ui";
import type { ReactNode } from "react";
import { useLocation, useNavigate } from "react-router";
import { useTwoDbPlugin } from "./plugin-provider";
import { settingsLayoutStyles } from "./settings-layout.style";

/**
 * Shared settings chrome: the plugin rail (only view plugins providing a
 * workspace.settings node, active while the url stays under its
 * /settings/<id> subtree) beside a content column. Plugin settings scenes
 * render inside this layout; the shell's generic /settings/:pluginId route
 * uses it for the empty states of the rest.
 */
export const SettingsLayout = ({ children }: { children: ReactNode }) => {
  const { plugins } = useTwoDbPlugin();
  const location = useLocation();
  const navigate = useNavigate();

  const withSettings = plugins.filter((plugin) => plugin.workspace?.settings != null);

  return (
    <div className="twdb-settings">
      <style jsx>{settingsLayoutStyles}</style>
      <NavPanel aria-label="Plugin settings">
        <NavPanelSection label="Plugins" />
        <NavPanelGroup>
          {withSettings.map((plugin) => (
            <NavPanelItem
              key={plugin.id}
              label={plugin.name ?? plugin.id}
              active={location.pathname.startsWith(`/settings/${plugin.id}`)}
              onClick={() => navigate(`/settings/${plugin.id}`)}
            />
          ))}
        </NavPanelGroup>
      </NavPanel>
      <section className="twdb-settings__content">{children}</section>
    </div>
  );
};
