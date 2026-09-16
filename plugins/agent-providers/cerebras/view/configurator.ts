import { createAuthConfigurator } from "@twodb/shared-frontend";

export const CerebrasConfigurator = createAuthConfigurator(
	{
	"providerId": "cerebras",
	"label": "Cerebras",
	"verify": false,
	"apiKey": {
		"required": true
	}
},
);
