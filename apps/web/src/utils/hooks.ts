import type { Identity } from "@twodb/shared-frontend";
import { usePluginStore } from "react-pluggable";

export const useIdentity = () => {
  const pluginStore = usePluginStore();

  const res: Identity = pluginStore.executeFunction("useIdentity");

  return res;
};
