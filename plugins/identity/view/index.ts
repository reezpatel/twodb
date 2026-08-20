// async function fetchSnapshot(): Promise<IdentitySnapshot> {
//   const session = await fetch("/api/v1/twodb.identity/auth/session", {
//     credentials: "same-origin",
//   });
//   if (!session.ok) {
//     setIdentitySnapshot(null);
//     return emptySnapshot();
//   }
//   const data = (await session.json()) as {
//     principal: { userId: string | null };
//   };
//   if (!data.principal?.userId) {
//     setIdentitySnapshot(null);
//     return emptySnapshot();
//   }
//   const me = await fetch("/api/v1/twodb.identity/me/memberships", {
//     credentials: "same-origin",
//   });
//   const memberships = me.ok
//     ? ((await me.json()) as {
//         workspaces: {
//           id: string;
//           orgId: string;
//           name: string;
//           orgName: string;
//         }[];
//       })
//     : { workspaces: [] };
//   const active = localStorage.getItem("activeWorkspaceId");
//   const activeWorkspaceId =
//     active && memberships.workspaces.some((w) => w.id === active)
//       ? active
//       : (memberships.workspaces[0]?.id ?? null);
//   const snap: IdentitySnapshot = {
//     user: { id: data.principal.userId, name: "", email: null },
//     workspaces: memberships.workspaces,
//     activeWorkspaceId,
//     roles: [],
//     claims: [],
//   };
//   setIdentitySnapshot(snap);
//   return snap;
// }

import type { ViewPluginManifest } from "../../../packages/contracts/src/plugin";
import { identityManifest } from "../shared/manifest";
import { TwodbIdentityPlugin } from "./plugin";
import { TwoDbIdentityProvider } from "./provider/identity-provider";

// function emptySnapshot(): IdentitySnapshot {
//   return {
//     user: null,
//     workspaces: [],
//     activeWorkspaceId: null,
//     roles: [],
//     claims: [],
//   };
// }

// async function switchWorkspace(workspaceId: string): Promise<void> {
//   localStorage.setItem("activeWorkspaceId", workspaceId);
//   await fetchSnapshot();
// }

// async function signOut(): Promise<void> {
//   await fetch("/api/v1/twodb.identity/auth/logout", {
//     method: "POST",
//     credentials: "same-origin",
//   });
//   setIdentitySnapshot(emptySnapshot());
// }

// const provider: IdentityProvider = {
//   LoginScreen,
//   VerifyScreen,
//   WorkspacePicker,
//   ShareDialog,
//   fetchSnapshot,
//   switchWorkspace,
//   signOut,
// };

const TwodbIdentityViewManifest: ViewPluginManifest = {
  ...identityManifest,
  provider: TwoDbIdentityProvider,
  plugin: new TwodbIdentityPlugin(),
};

export default TwodbIdentityViewManifest;
