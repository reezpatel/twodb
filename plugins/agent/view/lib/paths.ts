import { PLUGIN_ID } from "../../shared/constants";

export const AGENT_SETTINGS_PATH = `/settings/${PLUGIN_ID}`;

export const agentSettingsPath = (suffix = ""): string =>
	`${AGENT_SETTINGS_PATH}${suffix}`;
