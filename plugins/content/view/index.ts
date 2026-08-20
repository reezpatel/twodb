import type { ViewPluginManifest } from "@twodb/contracts";
import { contentManifest } from "../shared/manifest";
import { TwodbContentPlugin } from "./plugin";
import { TwoDbContentProvider } from "./provider/tree-provider";

const TwodbContentViewManifest: ViewPluginManifest = {
  ...contentManifest,
  provider: TwoDbContentProvider,
  plugin: new TwodbContentPlugin(),
};

export default TwodbContentViewManifest;
