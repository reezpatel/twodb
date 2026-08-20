import type { IPlugin, PluginStore } from "react-pluggable";
import { useTwoDbIdentity } from "./provider/identity-provider";
import type { RouteObject } from "react-router";
import { RegisterScreen } from "./scenes/register-screen/register-screen";
import { LoginScreen } from "./scenes/login-screen/login-screen";

export class TwodbIdentityPlugin implements IPlugin {
  pluginStore!: PluginStore;
  namespace = "Identity";

  private routes: RouteObject[] = [
    {
      path: "/register",
      element: <RegisterScreen />,
    },
    {
      path: "/login",
      element: <LoginScreen />,
    },
  ];

  getPluginName(): string {
    return "Identity@1.0.0";
  }

  getDependencies(): string[] {
    return [];
  }

  init(pluginStore: PluginStore): void {
    this.pluginStore = pluginStore;
  }

  activate(): void {
    this.pluginStore.addFunction("useIdentity", useTwoDbIdentity);

    this.pluginStore.executeFunction("core::add_routes", this.routes);
  }

  deactivate(): void {
    this.pluginStore.removeFunction(`useIdentity`);
  }
}
