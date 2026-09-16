import { createAuthConfigurator } from "@twodb/shared-frontend";

export const GoogleGeminiConfigurator = createAuthConfigurator(
	{
	"providerId": "google",
	"label": "Google Gemini",
	"verify": false,
	"apiKey": {
		"required": true
	}
},
);
