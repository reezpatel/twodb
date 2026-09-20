import { registerLlmProviderSetup, type ViewPlugin } from "@twodb/shared-frontend";
import { DeepSeekSetup } from "./setup";

registerLlmProviderSetup("io.twodb.llm.deepseek", DeepSeekSetup);

const DeepSeekViewPlugin = {
  id: "io.twodb.llm.deepseek",
} satisfies ViewPlugin;

export default DeepSeekViewPlugin;
