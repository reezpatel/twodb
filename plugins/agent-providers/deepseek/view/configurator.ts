import { createAuthConfigurator } from "@twodb/shared-frontend";

export const DeepSeekConfigurator = createAuthConfigurator(
	{
	"providerId": "deepseek",
	"label": "DeepSeek",
	"verify": false,
	"apiKey": {
		"required": true
	}
},
);
