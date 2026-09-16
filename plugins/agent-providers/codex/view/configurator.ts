import { createAuthConfigurator } from "@twodb/shared-frontend";

export const CodexConfigurator = createAuthConfigurator(
	{
	"providerId": "codex",
	"label": "OpenAI Codex",
	"verify": true,
	"apiKey": false,
	"oauth": {
		"loginUrl": "https://chatgpt.com/codex",
		"loginLabel": "Sign in with ChatGPT",
		"fields": [
			{
				"key": "refresh_token",
				"label": "Codex OAuth Refresh Token",
				"secret": true,
				"required": true,
				"placeholder": "~/.codex/auth.json → tokens.refresh_token — access tokens are auto-refreshed"
			},
			{
				"key": "access_token",
				"label": "Codex OAuth Access Token",
				"secret": true,
				"placeholder": "optional — auto-refreshed from the refresh token"
			},
			{
				"key": "account_id",
				"label": "ChatGPT Account ID",
				"placeholder": "optional — parsed from the token if absent"
			}
		]
	}
},
);
