import type { ReactNode } from "react";
import { Navigate, Route, Routes } from "react-router";
import { useTwoDbIdentity } from "../provider/IdentityProvider";
import { LoginScreen } from "./login-screen/login-screen";
import { RegisterScreen } from "./register-screen/register-screen";
import { FullPageLoader } from "./full-page-loader/full-page-loader";
import { WorkspaceCreator } from "./workspace-creator/workspace-creator";
import { WorkspacePicker } from "./workspace-picker/workspace-picker";

export const IdentityWrapper: React.FC<{ children: ReactNode }> = ({
	children,
}) => {
	const { isInitialLoading, user } = useTwoDbIdentity();

	if (isInitialLoading) {
		return <FullPageLoader />;
	}

	const principalUserId = user?.id ?? null;

	if (!principalUserId) {
		return (
			<Routes>
				<Route path="/register" element={<RegisterScreen />} />
				<Route path="/login" element={<LoginScreen />} />
				<Route path="*" element={<Navigate to="/login" replace />} />
			</Routes>
		);
	}

	return (
		<Routes>
			<Route path="/create-workspace" element={<WorkspaceCreator />} />
			<Route path="/workspaces" element={<WorkspacePicker />} />
			<Route path="*" element={children} />
		</Routes>
	);
};
