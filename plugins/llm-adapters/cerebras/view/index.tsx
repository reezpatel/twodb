import { registerLlmProviderSetup, type ViewPlugin } from "@twodb/shared-frontend";
import { CerebrasSetup } from "./setup";

registerLlmProviderSetup("io.twodb.llm.cerebras", CerebrasSetup);

const CerebrasViewPlugin = {
  id: "io.twodb.llm.cerebras",
} satisfies ViewPlugin;

export default CerebrasViewPlugin;
