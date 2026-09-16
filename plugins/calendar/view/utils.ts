import { ApiClient, ApiError } from "@twodb/shared-frontend";
import { PLUGIN_ID } from "../shared/constants";

export const apiClient = new ApiClient(PLUGIN_ID);

/** Query key prefix for every calendar query. */
export const CALENDAR_QK = PLUGIN_ID;

/**
 * Calendar queries can fire before the identity provider has persisted the
 * active workspace (first mount) — those 403. Retry a few times so the
 * query self-heals once `x-workspace-id` starts going out.
 */
export const calendarQueryRetry = {
	retry: (count: number, error: unknown) =>
		error instanceof ApiError && error.status === 403 && count < 5,
	retryDelay: 400,
} as const;
