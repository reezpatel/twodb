import { registerLlmProviderSetup, type ViewPlugin } from "@twodb/shared-frontend";
import { MistralSetup } from "./setup";

registerLlmProviderSetup("io.twodb.llm.mistral", MistralSetup);

const MistralViewPlugin = {
  id: "io.twodb.llm.mistral",
} satisfies ViewPlugin;

export default MistralViewPlugin;
