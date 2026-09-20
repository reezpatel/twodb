import { registerLlmProviderSetup, type ViewPlugin } from "@twodb/shared-frontend";
import { ZaiSetup } from "./setup";

registerLlmProviderSetup("io.twodb.llm.zai", ZaiSetup);

const ZaiViewPlugin = {
  id: "io.twodb.llm.zai",
} satisfies ViewPlugin;

export default ZaiViewPlugin;
