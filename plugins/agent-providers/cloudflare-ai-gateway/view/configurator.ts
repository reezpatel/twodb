import { createAuthConfigurator } from "@twodb/shared-frontend";

export const CloudflareAIGatewayConfigurator = createAuthConfigurator(
	{
	"providerId": "cloudflare-ai-gateway",
	"label": "Cloudflare AI Gateway",
	"verify": false,
	"apiKey": {
		"required": true
	},
	"fields": [
		{
			"key": "account_id",
			"label": "Account ID",
			"required": true
		},
		{
			"key": "gateway_id",
			"label": "Gateway ID",
			"required": true
		}
	]
},
);
