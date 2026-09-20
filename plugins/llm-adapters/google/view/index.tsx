import { registerLlmProviderSetup, type ViewPlugin } from "@twodb/shared-frontend";
import { GoogleSetup } from "./setup";

registerLlmProviderSetup("io.twodb.llm.google", GoogleSetup);

const GoogleViewPlugin = {
  id: "io.twodb.llm.google",
} satisfies ViewPlugin;

export default GoogleViewPlugin;
