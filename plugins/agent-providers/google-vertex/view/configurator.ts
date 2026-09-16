import { createAuthConfigurator } from "@twodb/shared-frontend";

export const GoogleVertexConfigurator = createAuthConfigurator(
	{
	"providerId": "google-vertex",
	"label": "Vertex AI",
	"verify": false,
	"apiKey": {
		"required": false
	},
	"fields": [
		{
			"key": "project",
			"label": "Project"
		},
		{
			"key": "location",
			"label": "Location",
			"placeholder": "us-central1"
		},
		{
			"key": "service_account_json",
			"label": "Service Account JSON",
			"secret": true
		}
	]
},
);
