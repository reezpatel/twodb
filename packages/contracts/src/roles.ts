export const DEFAULT_ROLE_KEYS = [
	"owner",
	"manager",
	"editor",
	"reader",
	"guest",
] as const;

export type DefaultRoleKey = (typeof DEFAULT_ROLE_KEYS)[number];

export type RoleDefaultKey = Exclude<DefaultRoleKey, "owner" | "guest">;

export const ROLE_DEFAULT_KEYS: readonly RoleDefaultKey[] = [
	"manager",
	"editor",
	"reader",
];

export function isDefaultRoleKey(value: string): value is DefaultRoleKey {
	return (DEFAULT_ROLE_KEYS as readonly string[]).includes(value);
}
