import { ApiError } from "@twodb/shared-frontend";

export function apiErrorMessage(error: unknown): string | undefined {
	if (error instanceof ApiError) {
		try {
			return (JSON.parse(error.body) as { error?: string }).error ?? error.body;
		} catch {
			return error.body;
		}
	}
	return error instanceof Error ? error.message : undefined;
}
