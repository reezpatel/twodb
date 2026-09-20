import { registerLlmProviderSetup, type ViewPlugin } from "@twodb/shared-frontend";
import { XaiSetup } from "./setup";

registerLlmProviderSetup("io.twodb.llm.xai", XaiSetup);

const XaiViewPlugin = {
  id: "io.twodb.llm.xai",
} satisfies ViewPlugin;

export default XaiViewPlugin;
