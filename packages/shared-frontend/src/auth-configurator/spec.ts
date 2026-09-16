export type AuthFieldSpec = {
	key: string;
	label: string;
	secret?: boolean;
	required?: boolean;
	placeholder?: string;
};

export type AuthConfiguratorSpec = {
	providerId: string;
	label: string;
	apiKey?: { label?: string; required?: boolean; placeholder?: string } | false;
	fields?: AuthFieldSpec[];
	oauth?: {
		loginUrl: string;
		loginLabel?: string;
		fields: AuthFieldSpec[];
	};
	verify?: boolean;
	hint?: { text: string; linkUrl: string; linkLabel: string };
};
