import { createAuthConfigurator } from "@twodb/shared-frontend";

export const TogetherAIConfigurator = createAuthConfigurator(
	{
	"providerId": "together",
	"label": "Together AI",
	"verify": false,
	"apiKey": {
		"required": true
	}
},
);
