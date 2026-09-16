import { createAuthConfigurator } from "@twodb/shared-frontend";

export const OllamaCloudConfigurator = createAuthConfigurator(
	{
	"providerId": "ollama-cloud",
	"label": "Ollama Cloud",
	"verify": true,
	"apiKey": {
		"required": true
	},
	"fields": [
		{
			"key": "cookie",
			"label": "Session Cookie",
			"secret": true,
			"required": true,
			"placeholder": "__Secure-session value"
		}
	]
},
);
