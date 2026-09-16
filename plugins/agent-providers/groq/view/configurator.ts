import { createAuthConfigurator } from "@twodb/shared-frontend";

export const GroqConfigurator = createAuthConfigurator(
	{
	"providerId": "groq",
	"label": "Groq",
	"verify": false,
	"apiKey": {
		"required": true
	}
},
);
