export const ENTITY_ID_PATTERN = /^[a-z]{3}-[0-9A-Za-z]{22}$/;

export const ID_PREFIXES = {
	user: "usr",
	session: "ses",
	org: "org",
	orgMembership: "omb",
	workspace: "wks",
	workspaceMember: "wmb",
	role: "rol",
	assignment: "asg",
	grant: "grt",
	app: "app",
	appRole: "aro",
	appRoleAssignment: "ara",
	authMethod: "amt",
	verificationCode: "vcd",
	auditEntry: "aud",
	note: "nte",
} as const;

export type IdPrefix = (typeof ID_PREFIXES)[keyof typeof ID_PREFIXES];

export function isEntityId(value: string): boolean {
	return ENTITY_ID_PATTERN.test(value);
}
