import { createAuthConfigurator } from "@twodb/shared-frontend";

export const MistralConfigurator = createAuthConfigurator(
	{
	"providerId": "mistral",
	"label": "Mistral",
	"verify": false,
	"apiKey": {
		"required": true
	}
},
);
