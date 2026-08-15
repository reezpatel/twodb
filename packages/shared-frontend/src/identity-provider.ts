import { useEffect, useState } from "react";
import type { Claim, Identity } from "@twodb/contracts";

/**
 * Task-09 §9.1 — the `identity` provider slot contract.
 *
 * A replacement identity view plugin publishes itself through the
 * `identity` slot via `registerIdentityProvider()`. The shell depends
 * only on this interface; it never imports a concrete plugin file.
 */

export interface ShareDialogProps {
	workspaceId: string;
	entityType: string;
	entityId: string;
}

export interface IdentitySnapshot {
	user: { id: string; name: string; email: string | null } | null;
	workspaces: { id: string; orgId: string; name: string; orgName: string }[];
	activeWorkspaceId: string | null;
	roles: string[];
	claims: string[];
}

export interface IdentityProvider {
	LoginScreen: React.ComponentType;
	VerifyScreen: React.ComponentType;
	WorkspacePicker: React.ComponentType;
	ShareDialog: React.ComponentType<ShareDialogProps>;
	fetchSnapshot: () => Promise<IdentitySnapshot>;
	switchWorkspace: (workspaceId: string) => Promise<void>;
	signOut: () => Promise<void>;
}

declare namespace React {
	type ComponentType<P = unknown> = (props: P) => unknown;
}

type IdentityImpl = IdentityProvider | null;
const providerHolder: { current: IdentityImpl } = { current: null };
const listeners = new Set<() => void>();

export function registerIdentityProvider(p: IdentityProvider): void {
	providerHolder.current = p;
	notifyIdentityChange();
}

export function unregisterIdentityProvider(): void {
	providerHolder.current = null;
	notifyIdentityChange();
}

export function getIdentityProvider(): IdentityProvider | null {
	return providerHolder.current;
}

export function subscribeIdentity(cb: () => void): () => void {
	listeners.add(cb);
	return () => {
		listeners.delete(cb);
	};
}

export function notifyIdentityChange(): void {
	for (const l of listeners) l();
}

let snapshotCache: IdentitySnapshot | null = null;

export function setIdentitySnapshot(snap: IdentitySnapshot | null): void {
	snapshotCache = snap;
	notifyIdentityChange();
}

export function getIdentitySnapshot(): IdentitySnapshot | null {
	return snapshotCache;
}

const EMPTY: Identity = {
	status: "signed_out",
	userId: null,
	userName: null,
	accountId: null,
	workspaceId: null,
	workspaces: [],
	activeWorkspace: null,
	roles: [],
	claims: [],
	hasClaim: () => false,
	switchWorkspace: async () => {},
	refetch: async () => {},
	signOut: async () => {},
};

export function useIdentity(): Identity {
	const [, setTick] = useState(0);
	useEffect(() => {
		const off = subscribeIdentity(() => setTick((n) => n + 1));
		return off;
	}, []);

	const provider = getIdentityProvider();
	const snap = snapshotCache;
	if (!provider) return EMPTY;
	const workspaces = (snap?.workspaces ?? []).map((w) => ({
		id: w.id,
		orgId: w.orgId,
		name: w.name,
		orgName: w.orgName,
	}));
	const activeWorkspaceId = snap?.activeWorkspaceId ?? null;
	const claims = (snap?.claims ?? []) as Claim[];
	return {
		...EMPTY,
		status: snap?.user ? "ready" : "signed_out",
		userId: snap?.user?.id ?? null,
		userName: snap?.user?.name ?? null,
		workspaceId: activeWorkspaceId,
		workspaces,
		activeWorkspace: activeWorkspaceId
			? workspaces.find((w) => w.id === activeWorkspaceId) ?? null
			: null,
		roles: snap?.roles ?? [],
		claims,
		hasClaim: (claim: Claim) => claims.includes(claim),
		switchWorkspace: async (id: string) => {
			await provider.switchWorkspace(id);
			notifyIdentityChange();
		},
		refetch: async () => {
			await provider.fetchSnapshot();
		},
		signOut: async () => {
			await provider.signOut();
		},
	};
}
