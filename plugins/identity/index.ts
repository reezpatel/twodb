import { TwodbIdentityViewManifest } from "./view/manifest";
import { TwodbIdentityServiceManifest } from "./service";
import type {
  ViewPluginManifest,
  ServicePluginManifest,
} from "@twodb/contracts";
import { PLUGIN_ID } from "./shared/constants";

const metadata = {
  id: PLUGIN_ID,
  name: "@twodb/identity",
  version: "1.0.0",
};

export const view = {
  ...TwodbIdentityViewManifest,
  ...metadata,
} satisfies ViewPluginManifest;

export const service = {
  ...TwodbIdentityServiceManifest,
  ...metadata,
} satisfies ServicePluginManifest;
