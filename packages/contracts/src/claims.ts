export const PLUGIN_CLAIM_PATTERN =
	/^plugin\.[a-z][a-z0-9]*(\.[a-z0-9]+)*:[a-z][a-z0-9]*(\.[a-z0-9]+)*$/;

export const APP_CLAIM_PATTERN =
	/^app\.[a-z][a-z0-9]*(\.[a-z0-9]+)*:[a-z][a-z0-9]*(\.[a-z0-9]+)*$/;

export type PluginClaim = `plugin.${string}:${string}`;
export type AppClaim = `app.${string}:${string}`;
export type Claim = PluginClaim | AppClaim;

export function isPluginClaim(value: string): value is PluginClaim {
	return PLUGIN_CLAIM_PATTERN.test(value);
}

export function isAppClaim(value: string): value is AppClaim {
	return APP_CLAIM_PATTERN.test(value);
}

export function isClaim(value: string): value is Claim {
	return isPluginClaim(value) || isAppClaim(value);
}
