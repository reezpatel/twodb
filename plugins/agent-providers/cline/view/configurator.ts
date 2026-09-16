import { createAuthConfigurator } from "@twodb/shared-frontend";

export const ClineConfigurator = createAuthConfigurator(
	{
	"providerId": "cline",
	"label": "Cline",
	"verify": true,
	"apiKey": {
		"required": false
	},
	"oauth": {
		"loginUrl": "https://app.cline.bot",
		"loginLabel": "Sign in with Cline",
		"fields": [
			{
				"key": "refresh_token",
				"label": "Session Refresh Token",
				"secret": true,
				"required": true,
				"placeholder": "api.cline.bot session — access tokens are auto-refreshed"
			},
			{
				"key": "access_token",
				"label": "Session Access Token",
				"secret": true,
				"placeholder": "optional — auto-refreshed from the refresh token"
			},
			{
				"key": "expires_at",
				"label": "Access Token Expiry (ms epoch)",
				"secret": true,
				"placeholder": "auto-maintained after the first refresh"
			}
		]
	}
},
);
