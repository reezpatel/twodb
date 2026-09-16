import { createAuthConfigurator } from "@twodb/shared-frontend";

export const CustomOpenAIConfigurator = createAuthConfigurator(
	{
	"providerId": "custom-openai",
	"label": "OpenAI-compatible",
	"verify": false,
	"apiKey": {
		"required": true
	},
	"fields": [
		{
			"key": "base_url",
			"label": "Base URL",
			"required": true,
			"placeholder": "http://localhost:11434/v1"
		}
	]
},
);
