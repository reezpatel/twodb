import { createAuthConfigurator } from "@twodb/shared-frontend";

export const XaiConfigurator = createAuthConfigurator(
	{
	"providerId": "xai",
	"label": "xAI",
	"verify": false,
	"apiKey": {
		"required": true
	}
},
);
