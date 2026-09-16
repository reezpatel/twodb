import { createAuthConfigurator } from "@twodb/shared-frontend";

export const AmazonBedrockConfigurator = createAuthConfigurator(
	{
	"providerId": "amazon-bedrock",
	"label": "Amazon Bedrock",
	"verify": false,
	"apiKey": {
		"required": false
	},
	"fields": [
		{
			"key": "region",
			"label": "Region",
			"required": true,
			"placeholder": "us-east-1"
		},
		{
			"key": "profile",
			"label": "AWS Profile"
		},
		{
			"key": "access_key_id",
			"label": "Access Key ID",
			"secret": true
		},
		{
			"key": "secret_access_key",
			"label": "Secret Access Key",
			"secret": true
		},
		{
			"key": "session_token",
			"label": "Session Token",
			"secret": true
		}
	]
},
);
