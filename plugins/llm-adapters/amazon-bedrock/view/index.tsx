import { registerLlmProviderSetup, type ViewPlugin } from "@twodb/shared-frontend";
import { BedrockSetup } from "./setup";

registerLlmProviderSetup("io.twodb.llm.amazon-bedrock", BedrockSetup);

const BedrockViewPlugin = {
  id: "io.twodb.llm.amazon-bedrock",
} satisfies ViewPlugin;

export default BedrockViewPlugin;
