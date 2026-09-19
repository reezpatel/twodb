import { AuthProvider } from "./provider/auth-provider";
import { AdminSettings } from "./admin-settings";
import { useAuth } from "./hooks/use-auth";
import type { ViewPlugin } from "@twodb/shared-frontend";

const AuthViewPlugin = {
  id: "io.twodb.auth",

  providers: [
    {
      provider: AuthProvider,
      priority: 100,
      provides: "auth",
      hooks: {
        useAuth,
      },
    },
  ],

  admin: {
    settings: AdminSettings,
  },

  workspace: {
    settings: <></>,
  },
} satisfies ViewPlugin;

export default AuthViewPlugin;
