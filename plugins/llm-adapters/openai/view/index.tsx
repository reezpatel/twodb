import { registerLlmProviderSetup, type ViewPlugin } from "@twodb/shared-frontend";
import { OpenAiSetup } from "./openai-setup";

registerLlmProviderSetup("io.twodb.llm.openai", OpenAiSetup);

const OpenAiViewPlugin = {
  id: "io.twodb.llm.openai",
} satisfies ViewPlugin;

export default OpenAiViewPlugin;
