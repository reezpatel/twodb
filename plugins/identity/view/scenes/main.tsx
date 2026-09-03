import type { ReactNode } from "react";
import { useTwoDbIdentity } from "../provider/identity-provider";
import { FullPageLoader } from "./full-page-loader/full-page-loader";

export const IdentityWrapper: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const { isInitialLoading } = useTwoDbIdentity();

  if (isInitialLoading) {
    return <FullPageLoader />;
  }

  return children;
};
