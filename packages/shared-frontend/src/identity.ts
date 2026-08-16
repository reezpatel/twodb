import { useMemo, useSyncExternalStore } from "react";
import type { ComponentType } from "react";

export interface IdentitySnapshot {
	user: { id: string; name: string; email: string | null } | null;
	workspaces: { id: string; orgId: string; name: string; orgName: string }[];
	activeWorkspaceId: string | null;
	roles: string[];
	claims: string[];
}

export interface IdentityProvider {
	LoginScreen: ComponentType;
	VerifyScreen: ComponentType;
	WorkspacePicker: ComponentType;
	WorkspaceCreator?: ComponentType;
	ShareDialog: ComponentType<ShareDialogProps>;
	fetchSnapshot: () => Promise<IdentitySnapshot>;
	switchWorkspace: (workspaceId: string) => Promise<void>;
	signOut: () => Promise<void>;
}

export interface ShareDialogProps {
	workspaceId: string;
	entityType: string;
	entityId: string;
}

export interface Identity {
	userId: string | null;
	userName: string | null;
	workspaceId: string | null;
	workspaces: IdentitySnapshot["workspaces"];
	activeWorkspace: IdentitySnapshot["workspaces"][number] | null;
	roles: string[];
	claims: string[];
	hasClaim: (claim: string) => boolean;
	switchWorkspace: (workspaceId: string) => void;
	refetch: () => Promise<void>;
	signOut: () => Promise<void>;
}

let snapshot: IdentitySnapshot | null = null;
const listeners = new Set<(s: IdentitySnapshot | null) => void>();

function emit() {
	listeners.forEach((listener) => listener(snapshot));
}

export function setIdentitySnapshot(value: IdentitySnapshot | null): void {
	snapshot = value;
	emit();
}

export function getIdentitySnapshot(): IdentitySnapshot | null {
	return snapshot;
}

function subscribe(callback: (s: IdentitySnapshot | null) => void): () => void {
	listeners.add(callback);
	return () => listeners.delete(callback);
}

let registeredProvider: IdentityProvider | null = null;

export function registerIdentityProvider(provider: IdentityProvider): void {
	registeredProvider = provider;
}

export function getIdentityProvider(): IdentityProvider | null {
	return registeredProvider;
}

export function useIdentity(): Identity {
	const snap = useSyncExternalStore(subscribe, getIdentitySnapshot);
	const provider = getIdentityProvider();

	return useMemo(() => {
		const activeWorkspace =
			snap?.workspaces.find((w) => w.id === snap?.activeWorkspaceId) ?? null;

		return {
			userId: snap?.user?.id ?? null,
			userName: snap?.user?.name ?? null,
			workspaceId: snap?.activeWorkspaceId ?? null,
			workspaces: snap?.workspaces ?? [],
			activeWorkspace,
			roles: snap?.roles ?? [],
			claims: snap?.claims ?? [],
			hasClaim: (claim: string) => snap?.claims.includes(claim) ?? false,
			switchWorkspace: (workspaceId: string) => {
				if (snap) {
					setIdentitySnapshot({ ...snap, activeWorkspaceId: workspaceId });
				}
				void provider?.switchWorkspace(workspaceId);
			},
			refetch: () =>
				provider?.fetchSnapshot().then(() => {}) ?? Promise.resolve(),
			signOut: () => provider?.signOut() ?? Promise.resolve(),
		};
	}, [snap, provider]);
}
