import { createAuthConfigurator } from "@twodb/shared-frontend";

export const AzureOpenAIConfigurator = createAuthConfigurator(
	{
	"providerId": "azure-openai",
	"label": "Azure OpenAI",
	"verify": false,
	"apiKey": {
		"required": true
	},
	"fields": [
		{
			"key": "base_url",
			"label": "Base URL",
			"required": true,
			"placeholder": "https://<resource>.openai.azure.com"
		},
		{
			"key": "api_version",
			"label": "API Version",
			"placeholder": "v1"
		},
		{
			"key": "deployment_name_map",
			"label": "Deployment Name Map",
			"placeholder": "gpt-4o-mini=my-deployment,gpt-4o=prod"
		}
	]
},
);
