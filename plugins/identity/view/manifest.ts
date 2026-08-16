import { TwodbIdentityPlugin } from ".";
import { TwoDbIdentityProvider } from "./provider/IdentityProvider";

export const TwodbIdentityViewManifest = {
  emits: [],
  consumes: [],
  permissions: [],
  provider: TwoDbIdentityProvider,
  plugin: new TwodbIdentityPlugin(),
};
