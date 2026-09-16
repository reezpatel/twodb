import { createAuthConfigurator } from "@twodb/shared-frontend";

export const KiloCodeConfigurator = createAuthConfigurator(
	{
	"providerId": "kilocode",
	"label": "Kilo Code",
	"verify": true,
	"apiKey": {
		"required": true
	},
	"fields": [
		{
			"key": "session_cookie",
			"label": "Session Cookie",
			"secret": true,
			"placeholder": "__Secure-next-auth.session-token value — for balance monitoring"
		}
	]
},
);
