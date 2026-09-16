import { createAuthConfigurator } from "@twodb/shared-frontend";

export const KimiCodeConfigurator = createAuthConfigurator({
	providerId: "kimi-code",
	label: "Kimi For Coding",
	verify: true,
	apiKey: { required: true, placeholder: "sk-..." },
	hint: {
		text: "Create a key in the",
		linkUrl: "https://www.kimi.com/coding/console",
		linkLabel: "Kimi For Coding console",
	},
});
