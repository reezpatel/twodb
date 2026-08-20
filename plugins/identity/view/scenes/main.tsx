import type { ReactNode } from "react";
import { Navigate, Route, Routes } from "react-router";
import { useTwoDbIdentity } from "../provider/identity-provider";
import { LoginScreen } from "./login-screen/login-screen";
import { RegisterScreen } from "./register-screen/register-screen";
import { FullPageLoader } from "./full-page-loader/full-page-loader";
import { WorkspaceCreator } from "./workspace-creator/workspace-creator";
import { WorkspacePicker } from "./workspace-picker/workspace-picker";
import { BrowserRouter } from "react-router";

export const IdentityWrapper: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const { isInitialLoading, user, activeWorkspace } = useTwoDbIdentity();

  if (isInitialLoading) {
    return <FullPageLoader />;
  }

  const principalUserId = user?.id ?? null;

  if (!principalUserId) {
    return <p>No Principal ID</p>;
  }

  return children;
};
