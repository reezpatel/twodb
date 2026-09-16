import { createAuthConfigurator } from "@twodb/shared-frontend";

export const CloudflareWorkersAIConfigurator = createAuthConfigurator(
	{
	"providerId": "cloudflare-workers-ai",
	"label": "Cloudflare Workers AI",
	"verify": false,
	"apiKey": {
		"required": true
	},
	"fields": [
		{
			"key": "account_id",
			"label": "Account ID",
			"required": true
		}
	]
},
);
