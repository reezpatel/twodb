import { registerLlmProviderSetup, type ViewPlugin } from "@twodb/shared-frontend";
import { FireworksSetup } from "./setup";

registerLlmProviderSetup("io.twodb.llm.fireworks", FireworksSetup);

const FireworksViewPlugin = {
  id: "io.twodb.llm.fireworks",
} satisfies ViewPlugin;

export default FireworksViewPlugin;
