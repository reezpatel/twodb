import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import type { SessionDto } from "../../shared/types";
import {
	archivedSessionsQueryKey,
	codeApi,
	sessionsQueryKey,
} from "../lib/api";

export type SessionItemStatus = "running" | "idle" | "done";

export interface SessionItem {
	id: string;
	title: string;
	status: SessionItemStatus;
	time: string;
}

export interface SessionGroup {
	id: string;
	name: string;
	sessions: SessionItem[];
}

const POLL_MS = 15_000;

/** "mnt/nvme1/workspace/personal/twodb" → "personal/twodb" */
const shortCwd = (cwd: string): string => {
	const parts = cwd.split("/").filter(Boolean);
	if (parts.length === 0) return cwd || ".";
	return parts.slice(-2).join("/");
};

const baseName = (cwd: string): string =>
	cwd.split("/").filter(Boolean).pop() ?? cwd;

const relativeTime = (iso: string): string => {
	const seconds = Math.max(
		0,
		Math.floor((Date.now() - new Date(iso).getTime()) / 1000),
	);
	if (seconds < 60) return `${seconds}s`;
	const minutes = Math.floor(seconds / 60);
	if (minutes < 60) return `${minutes}m`;
	const hours = Math.floor(minutes / 60);
	if (hours < 24) return `${hours}h`;
	const days = Math.floor(hours / 24);
	if (days < 7) return `${days}d`;
	return `${Math.floor(days / 7)}w`;
};

const toItem = (session: SessionDto): SessionItem => ({
	id: session.id,
	title: session.title?.trim() || baseName(session.cwd),
	status: session.running ? "running" : "idle",
	time: relativeTime(session.updated_at),
});

const groupByLocation = (sessions: SessionDto[]): SessionGroup[] => {
	const byLocation = new Map<string, SessionGroup>();
	for (const session of sessions) {
		const key = `${session.node_id}:${session.cwd}`;
		let group = byLocation.get(key);
		if (!group) {
			group = { id: key, name: shortCwd(session.cwd), sessions: [] };
			byLocation.set(key, group);
		}
		group.sessions.push(toItem(session));
	}
	return [...byLocation.values()];
};

const fetchSessions = async (archived: boolean): Promise<SessionDto[]> =>
	(
		await codeApi.get<{ sessions: SessionDto[] }>(
			archived ? "/sessions?archived=true" : "/sessions",
		)
	).sessions;

export function useSessionGroups() {
	const query = useQuery({
		queryKey: sessionsQueryKey,
		queryFn: () => fetchSessions(false),
		refetchInterval: POLL_MS,
	});
	const groups = useMemo(() => groupByLocation(query.data ?? []), [query.data]);
	return { groups, loading: query.isLoading };
}

export function useArchivedSessions() {
	const query = useQuery({
		queryKey: archivedSessionsQueryKey,
		queryFn: () => fetchSessions(true),
		refetchInterval: POLL_MS,
	});
	const sessions = useMemo(() => (query.data ?? []).map(toItem), [query.data]);
	return { sessions, loading: query.isLoading };
}
