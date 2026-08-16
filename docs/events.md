
export interface BackendEventMap {
  "twodb.notes.note.created": { note: Note };
  "twodb.notes.note.updated": { note: Note };
  "twodb.notes.note.deleted": { noteId: string };
  "twodb.identity.user.created": { userId: string };
  "twodb.identity.session.started": { userId: string; authMethod: string };
  "twodb.identity.org.created": { orgId: string; ownerId: string };
  "twodb.identity.workspace.created": { workspaceId: string; orgId: string };
  "twodb.identity.workspace.member.added": {
    workspaceId: string;
    userId: string;
  };
  "twodb.identity.workspace.member.removed": {
    workspaceId: string;
    userId: string;
  };
  "twodb.identity.role.created": { workspaceId: string; roleId: string };
  "twodb.identity.role.assigned": {
    workspaceId: string;
    userId: string;
    roleId: string;
  };
  "twodb.identity.role.revoked": {
    workspaceId: string;
    userId: string;
    roleId: string;
  };
  "twodb.identity.entity.granted": {
    workspaceId: string;
    entityType: string;
    entityId: string;
    userId: string;
    claims: string[];
  };
  "twodb.identity.entity.revoked": {
    workspaceId: string;
    entityType: string;
    entityId: string;
    userId: string;
  };
  "twodb.identity.app.role.assigned": {
    appId: string;
    userId: string;
    appRoleId: string;
  };
  "twodb.identity.app.role.revoked": {
    appId: string;
    userId: string;
    appRoleId: string;
  };
  "twodb.identity.app.created": {
    appId: string;
    workspaceId: string;
  };
  "twodb.identity.app.deleted": {
    appId: string;
    workspaceId: string;
  };
  "twodb.identity.org.suspended": {
    orgId: string;
    suspended: boolean;
  };
  "twodb.identity.superadmin.promoted": {
    userId: string;
  };
  "twodb.identity.superadmin.demoted": {
    userId: string;
  };
  "twodb.identity.authmethod.configured": { method: string };
}

export interface FrontendEventMap {
  "twodb.notes.note.selected": { noteId: string };
  "twodb.shell.phase.changed": { phase: "day" | "night" };
}

export type AppEventMap = FrontendEventMap & BackendEventMap;
