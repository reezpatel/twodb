import { createAuthConfigurator } from "@twodb/shared-frontend";

export const MiniMaxConfigurator = createAuthConfigurator(
	{
	"providerId": "minimax",
	"label": "MiniMax Coding Plan",
	"verify": true,
	"apiKey": {
		"required": true
	}
},
);
