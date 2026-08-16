import type { AuthCtx } from "../../lib/auth/ctx";
import { getDeploymentMethod } from "../../lib/users/methods";
import type { DeploymentMethodConfig } from "../../db/schema";

const discovered = new Map<string, OidcEndpoints>();

export interface OidcEndpoints {
	authorizationEndpoint: string;
	tokenEndpoint: string;
	userinfoEndpoint: string;
}

export async function endpointsFor(
	config: DeploymentMethodConfig,
): Promise<OidcEndpoints | null> {
	if (
		config.authorizationEndpoint &&
		config.tokenEndpoint &&
		config.userinfoEndpoint
	) {
		return {
			authorizationEndpoint: config.authorizationEndpoint,
			tokenEndpoint: config.tokenEndpoint,
			userinfoEndpoint: config.userinfoEndpoint,
		};
	}
	if (!config.issuer) return null;
	const cached = discovered.get(config.issuer);
	if (cached) return cached;
	const res = await fetch(
		`${config.issuer.replace(/\/$/, "")}/.well-known/openid-configuration`,
	);
	if (!res.ok) return null;
	const meta = (await res.json()) as {
		authorization_endpoint?: string;
		token_endpoint?: string;
		userinfo_endpoint?: string;
	};
	if (
		!meta.authorization_endpoint ||
		!meta.token_endpoint ||
		!meta.userinfo_endpoint
	) {
		return null;
	}
	const endpoints = {
		authorizationEndpoint: meta.authorization_endpoint,
		tokenEndpoint: meta.token_endpoint,
		userinfoEndpoint: meta.userinfo_endpoint,
	};
	discovered.set(config.issuer, endpoints);
	return endpoints;
}

export async function loadProvider(
	provider: string,
	ctx: AuthCtx,
): Promise<{
	config: DeploymentMethodConfig;
	endpoints: OidcEndpoints;
} | null> {
	const row = await getDeploymentMethod(ctx.db, `sso.${provider}`);
	if (!row?.enabled) return null;
	if (!row.config.clientId || !row.config.clientSecret) return null;
	const endpoints = await endpointsFor(row.config);
	if (!endpoints) return null;
	return { config: row.config, endpoints };
}

export const STATE_COOKIE = "twodb_sso_state";
