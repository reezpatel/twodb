import { createAuthConfigurator } from "@twodb/shared-frontend";

export const OpenAIConfigurator = createAuthConfigurator(
	{
	"providerId": "openai",
	"label": "OpenAI",
	"verify": true,
	"apiKey": {
		"required": true
	},
	"fields": [
		{
			"key": "access_token",
			"label": "ChatGPT OAuth Access Token",
			"secret": true,
			"placeholder": "for usage monitoring (subscription quota)"
		},
		{
			"key": "account_id",
			"label": "ChatGPT Account ID",
			"placeholder": "optional — parsed from the token if absent"
		}
	]
},
);
