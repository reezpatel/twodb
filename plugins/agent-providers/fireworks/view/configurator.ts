import { createAuthConfigurator } from "@twodb/shared-frontend";

export const FireworksConfigurator = createAuthConfigurator(
	{
	"providerId": "fireworks",
	"label": "Fireworks",
	"verify": false,
	"apiKey": {
		"required": true
	}
},
);
