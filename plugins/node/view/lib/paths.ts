import { PLUGIN_ID } from "../../shared/constants";

export const NODE_SETTINGS_PATH = `/settings/${PLUGIN_ID}`;

export const nodeSettingsPath = (suffix = ""): string =>
	`${NODE_SETTINGS_PATH}${suffix}`;
