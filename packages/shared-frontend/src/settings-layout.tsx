import {
	NavPanel,
	NavPanelGroup,
	NavPanelItem,
	NavPanelSection,
} from "@twodb/ui";
import type { ReactNode } from "react";
import { useLocation, useNavigate } from "react-router";
import { useTwoDbPlugin } from "./plugin-provider";
import { settingsLayoutStyles } from "./settings-layout.style";

/**
 * Shared settings chrome: the plugin rail (every registered view plugin,
 * active while the url stays under its /settings/<id> subtree) beside a
 * content column. Plugin settings scenes render inside this layout; the
 * shell's generic /settings/:pluginId route uses it for the empty states
 * of plugins that register no settings routes of their own.
 */
export const SettingsLayout = ({ children }: { children: ReactNode }) => {
	const { plugins } = useTwoDbPlugin();
	const location = useLocation();
	const navigate = useNavigate();

	return (
		<div className="twdb-settings">
			<style jsx>{settingsLayoutStyles}</style>
			<NavPanel aria-label="Plugin settings">
				<NavPanelSection label="Plugins" />
				<NavPanelGroup>
					{plugins.map((plugin) => (
						<NavPanelItem
							key={plugin.id}
							label={plugin.name}
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
