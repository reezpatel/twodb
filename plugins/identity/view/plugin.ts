import type { IPlugin, PluginStore } from "react-pluggable";
import { useTwoDbIdentity } from "./provider/IdentityProvider";

export class TwodbIdentityPlugin implements IPlugin {
  pluginStore!: PluginStore;
  namespace = "ShowAlert";

  getPluginName(): string {
    return "ShowAlert@1.0.0";
  }

  getDependencies(): string[] {
    return [];
  }

  init(pluginStore: PluginStore): void {
    this.pluginStore = pluginStore;
  }

  activate(): void {
    this.pluginStore.addFunction("useIdentity", useTwoDbIdentity);
  }

  deactivate(): void {
    this.pluginStore.removeFunction(`useIdentity`);
  }
}
