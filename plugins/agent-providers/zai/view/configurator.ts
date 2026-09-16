import { createAuthConfigurator } from "@twodb/shared-frontend";

export const ZaiConfigurator = createAuthConfigurator(
	{
	"providerId": "zai",
	"label": "Z.ai Coding Plan",
	"verify": true,
	"apiKey": {
		"required": true
	}
},
);
