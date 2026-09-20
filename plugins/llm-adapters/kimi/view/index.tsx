import { registerLlmProviderSetup, type ViewPlugin } from "@twodb/shared-frontend";
import { KimiSetup } from "./setup";

registerLlmProviderSetup("io.twodb.llm.kimi", KimiSetup);

const KimiViewPlugin = {
  id: "io.twodb.llm.kimi",
} satisfies ViewPlugin;

export default KimiViewPlugin;
