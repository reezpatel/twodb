import { AuthProvider } from "./provider/auth-provider";
import { ViewPlugin } from "@twodb/shared-frontend";

const AuthViewPlugin = {
  id: "io.twodb.auth",

  providers: [
    {
      provider: AuthProvider,
      priority: 100,
      provides: "auth",
      hooks: {
        useAuth: () => {},
      },
    },
  ],

  admin: {},

  workspace: {
    settings: <></>,
  },
} satisfies ViewPlugin;

export default AuthViewPlugin;
