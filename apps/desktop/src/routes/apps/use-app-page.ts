import { useParams } from "react-router";
import { getApp } from "../../lib/apps";

export function useAppPage() {
  const { appId } = useParams();
  const app = getApp(appId);
  return { app };
}
