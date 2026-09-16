export function parseJsonArray(raw: string | null): string[] | undefined {
	if (!raw) return undefined;
	try {
		const value: unknown = JSON.parse(raw);
		return Array.isArray(value) &&
			value.every((item) => typeof item === "string")
			? value
			: undefined;
	} catch {
		return undefined;
	}
}
