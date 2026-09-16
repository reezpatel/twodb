import { createAuthConfigurator } from "@twodb/shared-frontend";

export const AnthropicConfigurator = createAuthConfigurator(
	{
	"providerId": "anthropic",
	"label": "Anthropic",
	"verify": true,
	"apiKey": {
		"required": false
	},
	"oauth": {
		"loginUrl": "https://claude.ai/login",
		"loginLabel": "Sign in with Claude",
		"fields": [
			{
				"key": "refresh_token",
				"label": "Claude OAuth Refresh Token",
				"secret": true,
				"required": true,
				"placeholder": "~/.claude/.credentials.json → refreshToken — access tokens are auto-refreshed"
			},
			{
				"key": "access_token",
				"label": "Claude OAuth Access Token",
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
