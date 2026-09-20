import { registerLlmProviderSetup, type ViewPlugin } from "@twodb/shared-frontend";
import { OpenaiCompatibleSetup } from "./setup";

registerLlmProviderSetup("io.twodb.llm.openai-compatible", OpenaiCompatibleSetup);

const OpenaiCompatibleViewPlugin = {
  id: "io.twodb.llm.openai-compatible",
} satisfies ViewPlugin;

export default OpenaiCompatibleViewPlugin;
