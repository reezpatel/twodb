import { registerLlmProviderSetup, type ViewPlugin } from "@twodb/shared-frontend";
import { AzureOpenAiSetup } from "./setup";

registerLlmProviderSetup("io.twodb.llm.azure-openai", AzureOpenAiSetup);

const AzureOpenAiViewPlugin = {
  id: "io.twodb.llm.azure-openai",
} satisfies ViewPlugin;

export default AzureOpenAiViewPlugin;
