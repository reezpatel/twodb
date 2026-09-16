import { createAuthConfigurator } from "@twodb/shared-frontend";

export const OpenRouterConfigurator = createAuthConfigurator(
	{
	"providerId": "openrouter",
	"label": "OpenRouter",
	"verify": false,
	"apiKey": {
		"required": true
	}
},
);
