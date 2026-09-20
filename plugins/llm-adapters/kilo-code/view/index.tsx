import { registerLlmProviderSetup, type ViewPlugin } from "@twodb/shared-frontend";
import { KiloCodeSetup } from "./setup";

registerLlmProviderSetup("io.twodb.llm.kilo-code", KiloCodeSetup);

const KiloCodeViewPlugin = {
  id: "io.twodb.llm.kilo-code",
} satisfies ViewPlugin;

export default KiloCodeViewPlugin;
