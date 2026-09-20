import { registerLlmProviderSetup, type ViewPlugin } from "@twodb/shared-frontend";
import { GroqSetup } from "./setup";

registerLlmProviderSetup("io.twodb.llm.groq", GroqSetup);

const GroqViewPlugin = {
  id: "io.twodb.llm.groq",
} satisfies ViewPlugin;

export default GroqViewPlugin;
