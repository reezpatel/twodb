export interface CurrentUser {
	id: string;
	name: string;
}

export interface Principal {
	userId: string;
	isSuperadmin: boolean;
	workspaceId: string | null;
	claims: string[];
	isWorkspaceMember: boolean;
}
